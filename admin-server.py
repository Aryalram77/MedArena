#!/usr/bin/env python3
"""MedArena Admin — local content editor server.

Serves admin.html (the editor) + the user site, and provides a small API that
edits the embedded question banks inside surgery-practice.html in place.

  python admin-server.py            -> http://127.0.0.1:8600/admin
  python admin-server.py 9001       -> custom port

Every save is backed up into backups/ before the file is touched.
Bind is localhost-only so the admin panel is never exposed to the LAN.
"""
import base64
import json
import ipaddress
import os
import re
import shutil
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(ROOT, "surgery-practice.html")
INDEX_PATH = os.path.join(ROOT, "index.html")
BACKUP_DIR = os.path.join(ROOT, "backups")
IMG_DIR = os.path.join(ROOT, "cee-img")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8600

CTYPE = {
    ".html": "text/html; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
    ".json": "application/json", ".ico": "image/x-icon", ".js": "text/javascript",
}

_lock = threading.Lock()


# ---------- bank const extraction (string/escape aware brace matching) ----------

def find_const(html: str, name: str):
    """Return (start, end) byte-span in html of `const NAME = {...};` (JSON object incl.)."""
    sig = "const %s = " % name
    i = html.find(sig)
    if i < 0:
        return None
    j = html.find("{", i + len(sig))
    if j < 0:
        return None
    p, depth, instr, quote = j + 1, 1, False, ""
    while p < len(html) and depth > 0:
        c = html[p]
        if instr:
            if c == "\\":
                p += 2
                continue
            if c == quote:
                instr = False
        else:
            if c in "\"'":
                instr, quote = True, c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
        p += 1
    if depth != 0:
        return None
    return (i, p)  # include 'const NAME = ' prefix .. closing brace


def discover_banks(html: str):
    """id -> const-name mapping from the BANKS array."""
    out = []
    for m in re.finditer(r"id:\s*\"(\w+)\"\s*,\s*bank:\s*(\w+)\s*,\s*cat:\s*\"([^\"]*)\"", html):
        out.append({"id": m.group(1), "const": m.group(2), "cat": m.group(3)})
    return out


def load_html(path=HTML_PATH):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_concept():
    """const CONCEPT = null  or  const CONCEPT = {...};  (single line, in index.html)."""
    try:
        html = load_html(INDEX_PATH)
    except Exception:
        return {"title": "", "body": "", "img": "", "updated": ""}
    m = re.search(r"const CONCEPT = ([^\n]*);", html)
    if not m:
        return {"title": "", "body": "", "img": "", "updated": ""}
    try:
        val = json.loads(m.group(1))
        return val if isinstance(val, dict) else {"title": "", "body": "", "img": "", "updated": ""}
    except Exception:
        return {"title": "", "body": "", "img": "", "updated": ""}


HOMEPAGE_FIELDS = ("eyebrow", "titleLead", "titleAccent", "titleSecond", "subtitle", "ctaLabel", "banksEyebrow", "banksTitle", "banksSubtitle", "footerText")


def load_homepage_content():
    try:
        html = load_html(INDEX_PATH)
        m = re.search(r"const HOMEPAGE_CONTENT = ([^\n]*);", html)
        value = json.loads(m.group(1)) if m else {}
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def save_homepage_content(content):
    with _lock:
        html = load_html(INDEX_PATH)
        m = re.search(r"const HOMEPAGE_CONTENT = ([^\n]*);", html)
        if not m:
            raise RuntimeError("HOMEPAGE_CONTENT constant missing in index.html")
        current = json.loads(m.group(1))
        data = {key: content.get(key, current.get(key, "")) for key in HOMEPAGE_FIELDS}
        data["updated"] = time.strftime("%d %b %Y, %H:%M")
        encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
        updated = "const HOMEPAGE_CONTENT = %s;" % encoded
        html2 = html[:m.start()] + updated + html[m.end():]
        os.makedirs(BACKUP_DIR, exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        backup = os.path.join(BACKUP_DIR, "index-homepage-%s.html" % stamp)
        shutil.copyfile(INDEX_PATH, backup)
        with open(INDEX_PATH, "w", encoding="utf-8", newline="") as f:
            f.write(html2)
        saved = load_homepage_content()
        if any(saved.get(key) != data[key] for key in data):
            raise RuntimeError("homepage content verification failed")
        return os.path.basename(backup)


def save_concept(c, stamp):
    with _lock:
        keep = bool(c.get("title") or c.get("body") or c.get("img"))
        if keep:
            data = {"title": c.get("title", ""), "body": c.get("body", ""), "img": c.get("img", ""), "updated": stamp}
            js = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
        else:
            js = "null"
        line = "const CONCEPT = %s;" % js
        backups = []
        for path in (INDEX_PATH, HTML_PATH):
            html = load_html(path)
            if "const CONCEPT =" not in html:
                raise RuntimeError("CONCEPT constant missing in %s" % os.path.basename(path))
            os.makedirs(BACKUP_DIR, exist_ok=True)
            bpath = os.path.join(BACKUP_DIR, "%s-%s.html" % (os.path.splitext(os.path.basename(path))[0], time.strftime("%Y%m%d-%H%M%S")))
            shutil.copyfile(path, bpath)
            backups.append(os.path.basename(bpath))
            html2 = re.sub(r"const CONCEPT = [^\n]*;",
                           lambda _m, s=line: s,
                           html, count=1)
            if html2 == html:
                raise RuntimeError("could not replace CONCEPT in %s" % os.path.basename(path))
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(html2)
        # verify round-trip from index.html
        if keep:
            back = load_concept()
            if back.get("title") != data["title"] or back.get("img") != data["img"]:
                raise RuntimeError("verification failed after write")
        return backups


def serialize_bank(bank) -> str:
    s = json.dumps(bank, ensure_ascii=False, separators=(",", ":"))
    return s.replace("<", "\\u003c")


def ma_hash(s: str) -> str:
    """FNV-1a 32-bit over UTF-16 code units, forward + reversed — identical to medArenaHash() in JS."""
    import struct
    units = list(struct.unpack("<%dH" % len(s), s.encode("utf-16-le")))
    def fnv(us, rev=False):
        if rev:
            us = us[::-1]
        h = 0x811c9dc5
        for u in us:
            h ^= u
            h = (h * 16777619) & 0xFFFFFFFF
        return h
    return "%08x-%08x" % (fnv(units), fnv(units, True))


def load_lock():
    try:
        html = load_html(HTML_PATH)
    except Exception:
        return None
    m = re.search(r"const LOCK = ([^\n]*)", html)
    if not m:
        return None
    val = m.group(1).strip().rstrip(";").strip()
    if val == "null":
        return None
    try:
        parsed = json.loads(val)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def save_lock(enabled, code, stamp):
    with _lock:
        rev = None
        if enabled:
            if not code or len(code) < 3:
                raise RuntimeError("code must be at least 3 characters")
            rev = ma_hash(code)
            line = 'const LOCK = {"rev":"%s","updated":"%s"};' % (rev, stamp)
        else:
            line = "const LOCK = null;"
        html = load_html(HTML_PATH)
        if "const LOCK =" not in html:
            raise RuntimeError("LOCK constant missing in surgery-practice.html")
        os.makedirs(BACKUP_DIR, exist_ok=True)
        stamp24 = time.strftime("%Y%m%d-%H%M%S")
        bpath = os.path.join(BACKUP_DIR, "surgery-practice-%s.html" % stamp24)
        shutil.copyfile(HTML_PATH, bpath)
        html2 = re.sub(r"const LOCK = [^\n]*",
                       lambda _m, s=line: s,
                       html, count=1)
        if html2 == html:
            raise RuntimeError("could not replace LOCK")
        with open(HTML_PATH, "w", encoding="utf-8", newline="") as f:
            f.write(html2)
        back = load_lock()
        if enabled and (not back or back.get("rev") != rev):
            raise RuntimeError("verification failed after write")
        # mirror the lock state into index.html so the homepage can show the lock sign offline
        if enabled:
            pline = 'const PLOCK = {"rev":"%s","updated":"%s"};' % (rev, stamp)
        else:
            pline = "const PLOCK = null;"
        ipath = os.path.join(BACKUP_DIR, "index-%s.html" % stamp24)
        ihh = load_html(INDEX_PATH)
        shutil.copyfile(INDEX_PATH, ipath)
        if "const PLOCK =" in ihh:
            ih2 = re.sub(r"const PLOCK = [^\n]*",
                         lambda _m, s=pline: s,
                         ihh, count=1)
            if ih2 == ihh:
                raise RuntimeError("could not replace PLOCK in index.html")
        else:
            ih2 = re.sub(r"(const CONCEPT = [^\n]*\n)",
                         lambda _m, s=pline: _m.group(1) + s + "\n",
                         ihh, count=1)
            if ih2 == ihh:
                raise RuntimeError("could not insert PLOCK into index.html")
        with open(INDEX_PATH, "w", encoding="utf-8", newline="") as f:
            f.write(ih2)
        return os.path.basename(bpath)


# ---------- HTTP handler ----------

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):  # quiet
        pass

    def _send(self, code, ctype, body: bytes, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, obj, code=200):
        self._send(code, "application/json", json.dumps(obj).encode())

    def _file(self, path, fallback=None):
        full = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not full.startswith(ROOT) or not os.path.isfile(full):
            if fallback:
                full = fallback
            else:
                self._send(404, "text/plain", b"not found"); return
        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f:
            self._send(200, CTYPE.get(ext, "application/octet-stream"), f.read())

    def _is_loopback(self):
        try:
            return ipaddress.ip_address(self.client_address[0]).is_loopback
        except ValueError:
            return False

    def _body(self) -> bytes:
        n = int(self.headers.get("Content-Length", 0) or 0)
        return self.rfile.read(n) if n else b""

    # ---------------- GET ----------------
    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/home", "/index.html"):
            self._file("index.html"); return
        if path in ("/surgery-practice.html", "/practice"):
            self._file("surgery-practice.html"); return
        if path == "/admin":
            if not self._is_loopback():
                self._send(403, "text/plain", b"Admin is available only on this computer")
                return
            self._file("admin.html"); return
        if path.startswith("/api/banks"):
            with _lock:
                html = load_html()
                banks = []
                for e in discover_banks(html):
                    span = find_const(html, e["const"])
                    if not span:
                        continue
                    try:
                        data = json.loads(html[html.find("{", span[0]):span[1]])
                        banks.append({"id": e["id"], "cat": e["cat"], "name": data.get("name", e["id"]),
                                      "count": len(data.get("questions", []))})
                    except Exception:
                        banks.append({"id": e["id"], "cat": e["cat"], "name": e["const"], "count": -1})
                self._send_json(banks); return
        if path.startswith("/api/bank/"):
            bid = path[len("/api/bank/"):].strip("/")
            with _lock:
                html = load_html()
                ent = next((e for e in discover_banks(html) if e["id"] == bid), None)
                if not ent:
                    self._send_json({"error": "unknown bank id " + bid}, 404); return
                span = find_const(html, ent["const"])
                if not span:
                    self._send_json({"error": "const not found"}, 404); return
                try:
                    data = json.loads(html[html.find("{", span[0]):span[1]])
                except Exception as ex:
                    self._send_json({"error": "parse failed: %s" % ex}, 500); return
                self._send_json(data); return
        if path == "/api/homepage":
            self._send_json(load_homepage_content()); return
        if path == "/api/concept":
            self._send_json(load_concept()); return
        if path == "/api/access-settings":
            lk = load_lock()
            self._send_json({"enabled": bool(lk), "updated": (lk or {}).get("updated", ""),
                             "hash": (lk or {}).get("rev", "")})
            return
        if path.startswith("/cee-img/"):
            self._file(path); return
        if path == "/favicon.ico":
            self._send(204, "image/x-icon", b""); return
        self._send(404, "text/plain", b"not found")

    # ---------------- POST ----------------
    def do_POST(self):
        path = self.path.split("?")[0]
        if not self._is_loopback():
            self._send_json({"error": "Admin changes are available only on this computer"}, 403)
            return
        raw = self._body()
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            self._send_json({"error": "bad JSON body"}, 400); return

        if path == "/api/save/":
            bid = path[len("/api/save/"):].strip("/")
            bank = payload.get("bank")
            if not isinstance(bank, dict) or not isinstance(bank.get("questions"), list):
                self._send_json({"error": "payload must be {bank:{name,questions:[...]}}"}, 400); return
            with _lock:
                try:
                    html = load_html()
                    ent = next((e for e in discover_banks(html) if e["id"] == bid), None)
                    if not ent:
                        self._send_json({"error": "unknown bank id"}, 404); return
                    span = find_const(html, ent["const"])
                    if not span:
                        self._send_json({"error": "const not found"}, 404); return
                    new_text = "const %s = %s" % (ent["const"], serialize_bank(bank))
                    old_len = span[1] - span[0]
                    html = html[:span[0]] + new_text + html[span[1]:]
                    # backup, then write
                    os.makedirs(BACKUP_DIR, exist_ok=True)
                    stamp = time.strftime("%Y%m%d-%H%M%S")
                    bpath = os.path.join(BACKUP_DIR, "surgery-practice-%s.html" % stamp)
                    with open(HTML_PATH, "r", encoding="utf-8") as f:
                        shutil.copyfileobj(f, open(bpath, "w", encoding="utf-8"))
                    with open(HTML_PATH, "w", encoding="utf-8", newline="") as f:
                        f.write(html)
                    # verify: re-read and parse the const back
                    html2 = load_html()
                    span2 = find_const(html2, ent["const"])
                    json.loads(html2[html2.find("{", span2[0]):span2[1]])
                    self._send_json({"ok": True, "backup": os.path.basename(bpath),
                                     "msg": "%d questions · backup %s · (old block was %d bytes)" % (len(bank["questions"]), os.path.basename(bpath), old_len)})
                except Exception as ex:
                    self._send_json({"error": "save failed: %r" % ex}, 500)
            return

        if path == "/api/save-homepage":
            content = payload if isinstance(payload, dict) else {}
            for key in HOMEPAGE_FIELDS:
                if key in content and not isinstance(content[key], str):
                    self._send_json({"error": "field %s must be text" % key}, 400); return
            try:
                backup = save_homepage_content(content)
                self._send_json({"ok": True, "backup": backup, "msg": "saved to index.html · backup " + backup})
            except Exception as ex:
                self._send_json({"error": "save failed: %r" % ex}, 500)
            return

        if path == "/api/save-access-settings":
            enabled = bool(payload.get("enabled"))
            code = str(payload.get("code", ""))
            try:
                stamp = time.strftime("%d %b %Y, %H:%M")
                backup = save_lock(enabled, code, stamp)
                self._send_json({"ok": True, "msg": ("Lock set — backup " + backup) if enabled else ("Lock removed — backup " + backup)})
            except Exception as ex:
                self._send_json({"error": "%r" % ex}, 400 if "code must" in str(ex) else 500)
            return

        if path == "/api/save-concept":
            concept = payload if isinstance(payload, dict) else {}
            for k in ("title", "body", "img"):
                if not isinstance(concept.get(k, ""), str):
                    self._send_json({"error": "field %s must be text" % k}, 400); return
            try:
                stamp = time.strftime("%d %b %Y, %H:%M")
                backups = save_concept(concept, stamp)
                self._send_json({"ok": True, "backup": ", ".join(backups),
                                 "msg": "saved to index.html + surgery-practice.html · backups " + ", ".join(backups)})
            except Exception as ex:
                self._send_json({"error": "save failed: %r" % ex}, 500)
            return

        if path == "/api/image":
            name = payload.get("name", "")
            data = payload.get("data", "")
            ext = os.path.splitext(name)[1].lower()
            if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
                self._send_json({"error": "extension not allowed: " + ext}, 400); return
            rel = "cee-img/" + os.path.basename(name)
            full = os.path.join(IMG_DIR, os.path.basename(name))
            try:
                b64 = data.split(",", 1)[1] if "," in data else data
                with open(full, "wb") as f:
                    f.write(base64.b64decode(b64))
                self._send_json({"ok": True, "src": rel})
            except Exception as ex:
                self._send_json({"error": "image save failed: %r" % ex}, 500)
            return

        if path == "/api/delimg":
            src = payload.get("src", "")
            base = os.path.basename(src)
            full = os.path.join(IMG_DIR, base)
            try:
                os.remove(full)
                self._send_json({"ok": True})
            except Exception as ex:
                self._send_json({"error": "delete failed: %r" % ex}, 500)
            return

        self._send_json({"error": "unknown endpoint"}, 404)


def discover_lan_ipv4():
    """Find the IPv4 address selected for the active default network route."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # UDP connect selects a route locally; it sends no payload.
        probe.connect(("192.0.2.1", 9))
        address = probe.getsockname()[0]
        parsed = ipaddress.ip_address(address)
        return address if parsed.version == 4 and parsed.is_private and not parsed.is_loopback else None
    except OSError:
        return None
    finally:
        probe.close()


def main():
    os.makedirs(IMG_DIR, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    lan_srv = None
    lan_ip = discover_lan_ipv4()
    if lan_ip:
        try:
            lan_srv = ThreadingHTTPServer((lan_ip, PORT), Handler)
            threading.Thread(target=lan_srv.serve_forever, daemon=True).start()
        except OSError as ex:
            print("Wi-Fi listener unavailable: %s" % ex)
            lan_srv = None
    print("MedArena Admin (local only): http://127.0.0.1:%d/admin" % PORT)
    if lan_srv:
        print("  Wi-Fi user site:       http://%s:%d/home" % (lan_ip, PORT))
    else:
        print("  Wi-Fi user site:       unavailable (no private IPv4 route)")
    print("  editing file:          %s" % HTML_PATH)
    print("  Ctrl+C to stop")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        if lan_srv:
            lan_srv.shutdown()
            lan_srv.server_close()


if __name__ == "__main__":
    main()


