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
import hashlib
import hmac
import json
import ipaddress
import os
import re
import secrets
import shutil
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, unquote
from urllib.request import urlopen

ROOT = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(ROOT, "surgery-practice.html")
INDEX_PATH = os.path.join(ROOT, "index.html")
BACKUP_DIR = os.path.join(ROOT, "backups")
IMG_DIR = os.path.join(ROOT, "cee-img")
USERS_PATH = os.path.join(ROOT, "medarena-users.json")
SUBS_PATH = os.path.join(ROOT, "medarena-subs.json")
AUTH_CONFIG_PATH = os.path.join(ROOT, "auth-config.json")
SESSION_COOKIE = "ma_sess"
SESSION_TTL = 60 * 24 * 3600  # 60 days
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8600

CTYPE = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
    ".json": "application/json", ".ico": "image/x-icon", ".js": "text/javascript",
    ".pdf": "application/pdf", ".woff2": "font/woff2", ".woff": "font/woff",
    ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8",
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


def question_of_day():
    """Pick one question for today, rotating deterministically by date.

    The homepage and the admin preview both call /api/question-of-day. It used
    to exist only on the Cloudflare worker, so locally the request 404'd and the
    Question of the Day section stayed hidden. This mirrors the worker's shape:
    {date, bankId, bankName, question:{n, stem, options, answerLetter,
    answerText, explanation}}.
    """
    today = time.strftime("%Y-%m-%d")
    try:
        html = load_html()
    except Exception:
        return {"date": today, "bankId": "", "bankName": "", "question": None}

    # Collect every parseable bank, then choose (bank, question) from the date.
    pool = []
    for e in discover_banks(html):
        span = find_const(html, e["const"])
        if not span:
            continue
        try:
            data = json.loads(html[html.find("{", span[0]):span[1]])
        except Exception:
            continue
        qs = data.get("questions") or []
        if qs:
            pool.append((e["id"], data.get("name") or e["id"], qs))
    if not pool:
        return {"date": today, "bankId": "", "bankName": "", "question": None}

    # Stable per-day rotation: same question all day, different tomorrow.
    seed = int(time.strftime("%Y%m%d"))
    bank_id, bank_name, questions = pool[seed % len(pool)]
    q = questions[(seed // max(1, len(pool))) % len(questions)]

    opts = q.get("options") or []
    # Banks store the key as correctSet:["D"] plus answerLetter/answerText,
    # not a per-option `correct` flag.
    answer_letter = q.get("answerLetter") or ""
    answer_text = q.get("answerText") or ""
    if not answer_letter:
        cs = q.get("correctSet") or []
        if cs:
            answer_letter = cs[0]
    if not answer_text and answer_letter:
        for o in opts:
            if o.get("letter") == answer_letter:
                answer_text = o.get("text", "")
                break

    return {
        "date": today,
        "bankId": bank_id,
        "bankName": bank_name,
        "question": {
            "n": q.get("n"),
            "stem": q.get("stem", ""),
            "chapter": q.get("chapter", ""),
            "options": [{"letter": o.get("letter", ""), "text": o.get("text", "")} for o in opts],
            "answerLetter": answer_letter,
            "answerText": answer_text,
            "explanation": q.get("explanation") or q.get("answer") or "",
        },
    }


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


def load_notification():
    try:
        html = load_html(INDEX_PATH)
        m = re.search(r"const NOTIFICATION_CONTENT = ([^\n]*);", html)
        value = json.loads(m.group(1)) if m else {}
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def save_notification_content(content):
    with _lock:
        html = load_html(INDEX_PATH)
        m = re.search(r"const NOTIFICATION_CONTENT = ([^\n]*);", html)
        if not m:
            raise RuntimeError("NOTIFICATION_CONTENT constant missing in index.html")
        data = content if isinstance(content, dict) else {}
        data["updated"] = time.strftime("%d %b %Y, %H:%M")
        encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
        updated = "const NOTIFICATION_CONTENT = %s;" % encoded
        html2 = html[:m.start()] + updated + html[m.end():]
        os.makedirs(BACKUP_DIR, exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        backup = os.path.join(BACKUP_DIR, "index-notification-%s.html" % stamp)
        shutil.copyfile(INDEX_PATH, backup)
        with open(INDEX_PATH, "w", encoding="utf-8", newline="") as f:
            f.write(html2)
        saved = load_notification()
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


def save_lock(enabled, code, banks, stamp, keep_code=False):
    with _lock:
        html = load_html(HTML_PATH)
        if enabled:
            existing = load_lock()
            if keep_code:
                if not existing or not existing.get("rev"):
                    raise RuntimeError("no existing lock to keep — set a code first")
                rev = existing["rev"]
            else:
                if not code or len(code) < 3:
                    raise RuntimeError("code must be at least 3 characters")
                rev = ma_hash(code)
            banks = [str(b) for b in (banks or []) if str(b)]
            if not banks:
                raise RuntimeError("select at least one set to lock")
            known = {e["id"] for e in discover_banks(html)}
            unknown = [b for b in banks if b not in known]
            if unknown:
                raise RuntimeError("unknown bank id(s): " + ", ".join(unknown))
            obj = {"rev": rev, "updated": stamp, "banks": banks}
            line = "const LOCK = %s;" % json.dumps(obj, separators=(",", ":"))
            pobj = {"rev": rev, "updated": stamp, "banks": banks}
            pline = "const PLOCK = %s;" % json.dumps(pobj, separators=(",", ":"))
        else:
            rev = None
            line = "const LOCK = null;"
            pline = "const PLOCK = null;"
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
        if enabled and (not back or back.get("rev") != rev or back.get("banks") != banks):
            raise RuntimeError("verification failed after write")
        # mirror the lock state into index.html so the homepage can mark locked sets offline
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


# ---------- lifetime subscriptions (Rs 1,000 · eSewa) ----------
import secrets

SUB_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no I/L/O/0/1 — readable when dictated
DEV_RE = re.compile(r"^MA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$")


def load_subs_log():
    try:
        with open(SUBS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_subs_log(entries):
    with open(SUBS_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def update_lock_subs(subs):
    """Write LOCK.subs into surgery-practice.html and mirror into index.html (PLOCK)."""
    with _lock:
        html = load_html(HTML_PATH)
        lk = load_lock()
        if not lk:
            raise RuntimeError("no practice lock is set — enable the lock first (sets stay premium-only)")
        lk["subs"] = subs
        lk["updated"] = time.strftime("%d %b %Y, %H:%M")
        line = "const LOCK = %s;" % json.dumps(lk, separators=(",", ":"))
        pobj = {k: lk[k] for k in ("rev", "updated", "banks", "subs") if k in lk}
        pline = "const PLOCK = %s;" % json.dumps(pobj, separators=(",", ":"))
        os.makedirs(BACKUP_DIR, exist_ok=True)
        stamp24 = time.strftime("%Y%m%d-%H%M%S")
        shutil.copyfile(HTML_PATH, os.path.join(BACKUP_DIR, "surgery-practice-%s.html" % stamp24))
        html2 = re.sub(r"const LOCK = [^\n]*", lambda _m, s=line: s, html, count=1)
        if html2 == html:
            raise RuntimeError("could not replace LOCK")
        with open(HTML_PATH, "w", encoding="utf-8", newline="") as f:
            f.write(html2)
        back = load_lock()
        if back.get("subs") != subs:
            raise RuntimeError("verification failed after write")
        shutil.copyfile(INDEX_PATH, os.path.join(BACKUP_DIR, "index-%s.html" % stamp24))
        ihh = load_html(INDEX_PATH)
        if "const PLOCK =" not in ihh:
            raise RuntimeError("PLOCK missing in index.html")
        ih2 = re.sub(r"const PLOCK = [^\n]*", lambda _m, s=pline: s, ihh, count=1)
        if ih2 == ihh:
            raise RuntimeError("could not replace PLOCK in index.html")
        with open(INDEX_PATH, "w", encoding="utf-8", newline="") as f:
            f.write(ih2)
        return lk


def generate_sub(dev_id, note):
    dev_id = str(dev_id or "").strip().upper()
    if not DEV_RE.match(dev_id):
        raise RuntimeError("Device ID must look like MA-XXXX-XXXX (no I/L/O/0/1)")
    lk = load_lock() or {}
    active = {s.get("id") for s in (lk.get("subs") or []) if s.get("id")}
    if dev_id in active:
        raise RuntimeError("this Device ID already has an active code — revoke it first")
    code = "MA-%s-%s" % ("".join(secrets.choice(SUB_ALPHABET) for _ in range(4)),
                         "".join(secrets.choice(SUB_ALPHABET) for _ in range(4)))
    rev = ma_hash(dev_id + "#" + code)
    update_lock_subs((lk.get("subs") or []) + [{"id": dev_id, "rev": rev,
                                               "at": time.strftime("%d %b %Y, %H:%M")}])
    entry = {"devId": dev_id, "code": code, "rev": rev, "note": str(note or "")[:120],
             "createdAt": time.strftime("%d %b %Y, %H:%M")}
    log = load_subs_log()
    log.insert(0, entry)
    save_subs_log(log)
    return entry


def revoke_sub(dev_id):
    dev_id = str(dev_id or "").strip().upper()
    if not DEV_RE.match(dev_id):
        raise RuntimeError("bad Device ID")
    lk = load_lock() or {}
    cur = lk.get("subs") or []
    new = [s for s in cur if s.get("id") != dev_id]
    if len(new) == len(cur):
        raise RuntimeError("no active code for this Device ID")
    update_lock_subs(new)
    log = load_subs_log()
    changed = False
    for e in log:
        if e.get("devId") == dev_id and not e.get("revoked"):
            e["revoked"] = time.strftime("%d %b %Y, %H:%M")
            changed = True
    if changed:
        save_subs_log(log)
    return True


# ---------- HTTP handler ----------

# ---------------- Google sign-in + per-user progress store ----------------

def load_auth_config():
    try:
        with open(AUTH_CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        return cfg if isinstance(cfg, dict) else {}
    except Exception:
        return {}


def google_client_id():
    return (load_auth_config().get("client_id") or "").strip()


def save_google_client_id(cid):
    cfg = load_auth_config()
    cfg["client_id"] = (cid or "").strip()
    with open(AUTH_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=1)
    return cfg


# ---------------- admin password ----------------
# The admin panel edits the site, so it needs its own password. Loopback alone
# is not enough: a tunnel (ngrok, cloudflared) makes the request look local, so
# the password is the real gate and loopback is only a second lock.

ADMIN_PATH = os.path.join(ROOT, "admin-auth.json")
ADMIN_COOKIE = "ma_admin"
ADMIN_TTL = 12 * 3600  # 12 hours


def load_admin_db():
    try:
        with open(ADMIN_PATH, "r", encoding="utf-8") as f:
            db = json.load(f)
        if not isinstance(db, dict):
            db = {}
    except Exception:
        db = {}
    db.setdefault("pw", None)
    db.setdefault("sessions", {})
    return db


def save_admin_db(db):
    tmp = ADMIN_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=1)
    os.replace(tmp, ADMIN_PATH)


def admin_configured():
    return bool(load_admin_db().get("pw"))


def admin_session_ok(handler):
    """True when this request carries a live admin session cookie."""
    sid = handler._cookies().get(ADMIN_COOKIE, "")
    if not sid:
        return False
    db = load_admin_db()
    ses = db["sessions"].get(sid)
    if not isinstance(ses, dict):
        return False
    try:
        if float(ses.get("exp", 0)) < time.time():
            return False
    except (TypeError, ValueError):
        return False
    return True


def create_admin_session():
    db = load_admin_db()
    sid = secrets.token_urlsafe(32)
    now = time.time()
    db["sessions"][sid] = {"exp": now + ADMIN_TTL, "created": int(now)}
    # drop expired sessions so the file does not grow forever
    db["sessions"] = {k: v for k, v in db["sessions"].items()
                      if isinstance(v, dict) and float(v.get("exp", 0) or 0) > now}
    save_admin_db(db)
    return sid


def load_users_db():
    try:
        with open(USERS_PATH, "r", encoding="utf-8") as f:
            db = json.load(f)
        if not isinstance(db, dict):
            db = {}
    except Exception:
        db = {}
    db.setdefault("users", {})
    db.setdefault("sessions", {})
    return db


def save_users_db(db):
    tmp = USERS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=1)
    os.replace(tmp, USERS_PATH)


def verify_google_id_token(token):
    """Validate a Google Identity Services ID token. Returns the tokeninfo dict.

    Raises ValueError with a user-friendly message when the token is not
    usable; other exceptions mean Google could not be reached."""
    cid = google_client_id()
    if not cid:
        raise ValueError("Google login is not configured yet — set the Client ID in the admin panel.")
    url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + quote(token)
    with urlopen(url, timeout=10) as r:
        info = json.loads(r.read().decode("utf-8"))
    if info.get("aud") != cid:
        raise ValueError("ID token audience mismatch (wrong Google Client ID).")
    try:
        if int(info.get("exp", 0)) < time.time():
            raise ValueError("ID token expired — please sign in again.")
    except (TypeError, ValueError):
        raise ValueError("ID token expired — please sign in again.")
    if not info.get("sub"):
        raise ValueError("ID token missing subject.")
    if info.get("email_verified") is False and info.get("email"):
        raise ValueError("Google account e-mail is not verified.")
    return info


def public_user(u):
    if not u:
        return None
    return {"sub": u.get("sub", ""), "name": u.get("name", ""),
            "email": u.get("email", ""), "picture": u.get("picture", ""),
            "provider": u.get("provider", "google"),
            "created": u.get("created", 0), "last_seen": u.get("last_seen", 0)}


# ---------------- e-mail + password accounts ----------------

PBKDF2_ROUNDS = 200_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


def hash_password(password: str, salt: str = None) -> dict:
    """PBKDF2-HMAC-SHA256. Returns {salt, hash, rounds} for storage."""
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ROUNDS)
    return {"salt": salt, "hash": dk.hex(), "rounds": PBKDF2_ROUNDS}


def check_password(password: str, rec: dict) -> bool:
    if not isinstance(rec, dict) or not rec.get("hash") or not rec.get("salt"):
        return False
    try:
        rounds = int(rec.get("rounds") or PBKDF2_ROUNDS)
    except (TypeError, ValueError):
        rounds = PBKDF2_ROUNDS
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), rec["salt"].encode("utf-8"), rounds)
    return hmac.compare_digest(dk.hex(), rec["hash"])


def norm_email(email: str) -> str:
    return (email or "").strip().lower()


def email_sub(email: str) -> str:
    """Stable user id for a password account."""
    return "pw:" + norm_email(email)


def progress_summary(progress: dict) -> dict:
    """Solved / correct / accuracy + per-bank rollup from a progress map."""
    solved = correct = 0
    banks = {}
    for qid, v in (progress or {}).items():
        if not isinstance(qid, str) or "|" not in qid:
            continue
        solved += 1
        ok = 1 if isinstance(v, dict) and v.get("c") else 0
        correct += ok
        bid = qid.split("|", 1)[0]
        b = banks.setdefault(bid, {"solved": 0, "correct": 0})
        b["solved"] += 1
        b["correct"] += ok
    return {"solved": solved, "correct": correct,
            "accuracy": round(correct * 100.0 / solved) if solved else 0,
            "banks": banks}


def create_session(db, sub: str) -> str:
    now = int(time.time())
    sid = secrets.token_urlsafe(32)
    db["sessions"] = {k: v for k, v in db["sessions"].items()
                      if float(v.get("exp", 0) or 0) >= now}
    db["sessions"][sid] = {"sub": sub, "exp": now + SESSION_TTL}
    return sid


def session_cookie(sid: str) -> str:
    return "%s=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d" % (SESSION_COOKIE, sid, SESSION_TTL)


def clear_cookie() -> str:
    return "%s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" % SESSION_COOKIE


def admin_users_report():
    """Every account with its progress summary — for the admin dashboard."""
    db = load_users_db()
    now = int(time.time())
    active = {}
    for ses in db["sessions"].values():
        try:
            if float(ses.get("exp", 0) or 0) >= now:
                active[ses.get("sub", "")] = active.get(ses.get("sub", ""), 0) + 1
        except (TypeError, ValueError):
            continue
    out = []
    for sub, u in db["users"].items():
        if not isinstance(u, dict):
            continue
        prog = u.get("progress") or {}
        s = progress_summary(prog)
        last = 0
        for v in prog.values():
            if isinstance(v, dict):
                try:
                    last = max(last, int(v.get("t", 0) or 0))
                except (TypeError, ValueError):
                    pass
        out.append({
            "sub": sub,
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "picture": u.get("picture", ""),
            "provider": u.get("provider", "google"),
            "created": u.get("created", 0),
            "last_seen": u.get("last_seen", 0),
            "last_answer": last,
            "solved": s["solved"], "correct": s["correct"], "accuracy": s["accuracy"],
            "banks": s["banks"],
            "sessions": active.get(sub, 0),
        })
    out.sort(key=lambda r: (r["solved"], r["last_seen"]), reverse=True)
    return out


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

    def _send_json(self, obj, code=200, extra=None):
        self._send(code, "application/json", json.dumps(obj).encode(), extra=extra)

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

    def _cookies(self):
        out = {}
        for part in (self.headers.get("Cookie", "") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k:
                out[k] = v
        return out

    def _session(self):
        """-> (user dict or None, session id or None) for the request cookie."""
        sid = self._cookies().get(SESSION_COOKIE, "")
        if not sid:
            return None, None
        db = load_users_db()
        ses = db["sessions"].get(sid)
        if not ses:
            return None, None
        try:
            if float(ses.get("exp", 0)) < time.time():
                return None, None
        except (TypeError, ValueError):
            return None, None
        return db["users"].get(ses.get("sub", "")), sid

    # ---------------- GET ----------------
    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/home", "/index.html"):
            self._file("index.html"); return
        if path in ("/surgery-practice.html", "/practice"):
            self._file("surgery-practice.html"); return
        # Standalone pages linked from the homepage. They were served by the
        # static host but not routed here, so every local click 404'd.
        if path in ("/high-yield.html", "/very-high-yield"):
            self._file("high-yield.html"); return
        if path in ("/emergency-stp.html", "/emergency-stp"):
            self._file("emergency-stp.html"); return
        if path == "/auth.js":
            self._file("auth.js"); return
        if path == "/auth.css":
            self._file("auth.css"); return
        if path in ("/pdf.min.js", "/pdf.worker.min.js"):
            self._file(path.lstrip("/")); return
        if path == "/admin":
            if not self._is_loopback():
                self._send(403, "text/plain", b"Admin is available only on this computer")
                return
            self._file("admin.html"); return
        if path == "/api/admin/status":
            self._send_json({"configured": admin_configured(),
                             "signed_in": admin_session_ok(self),
                             "loopback": self._is_loopback()}); return
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
        if path == "/api/notification":
            self._send_json(load_notification()); return
        if path == "/api/concept":
            self._send_json(load_concept()); return
        if path == "/api/question-of-day":
            self._send_json(question_of_day()); return
        if path == "/api/sub-verify":
            # The homepage asks whether this device already holds a valid code.
            # It used to hit only the Cloudflare worker, so locally it 404'd.
            dev = (unquote(self.path.split("dev=")[-1].split("&")[0]) if "dev=" in self.path else "").strip().upper()
            lk = load_lock() or {}
            rev = ""
            for s in (lk.get("subs") or []):
                if s.get("id") == dev and s.get("rev"):
                    rev = s["rev"]
                    break
            self._send_json({"dev": dev, "rev": rev}); return
        if path == "/api/access-settings":
            lk = load_lock()
            banks = lk.get("banks") if lk else None
            self._send_json({"enabled": bool(lk), "updated": (lk or {}).get("updated", ""),
                             "hash": (lk or {}).get("rev", ""), "banks": banks})
            return
        if path == "/api/subs":
            if not (self._is_loopback() or admin_session_ok(self)):
                self._send_json({"error": "admin only"}, 403); return
            lk = load_lock() or {}
            self._send_json({"enabled": bool(lk.get("rev")), "subs": lk.get("subs", []),
                             "log": load_subs_log()})
            return
        if path == "/api/auth/config":
            cid = google_client_id()
            self._send_json({"client_id": cid,
                             "ready": bool(cid),
                             "origin": self.headers.get("Origin", "") or "",
                             "password_login": True})
            return
        if path == "/api/me":
            user, _sid = self._session()
            self._send_json({"user": public_user(user)})
            return
        if path == "/api/progress":
            user, _sid = self._session()
            if not user:
                self._send_json({"error": "not signed in"}, 401); return
            self._send_json({"progress": user.get("progress", {})})
            return
        if path == "/api/session":
            user, _sid = self._session()
            if not user:
                self._send_json({"error": "not signed in"}, 401); return
            bank = ""
            if "?" in self.path:
                from urllib.parse import parse_qs, urlparse
                bank = parse_qs(urlparse(self.path).query).get("bank", [""])[0]
            with _lock:
                db = load_users_db()
                u = db["users"].get(user["sub"], {}) or {}
                sess = (u.get("resume") or {}).get(bank) if bank else u.get("resume")
            self._send_json({"session": sess})
            return
        if path == "/api/admin/users":
            if not (self._is_loopback() or admin_session_ok(self)):
                self._send_json({"error": "admin only"}, 403); return
            users = admin_users_report()
            totals = {"users": len(users),
                      "solved": sum(u["solved"] for u in users),
                      "correct": sum(u["correct"] for u in users),
                      "active": sum(1 for u in users if u["sessions"]),
                      "signed_in_7d": sum(1 for u in users if u["last_seen"] and u["last_seen"] > time.time() - 7 * 86400)}
            self._send_json({"users": users, "totals": totals})
            return
        if path.startswith("/api/admin/user/"):
            if not (self._is_loopback() or admin_session_ok(self)):
                self._send_json({"error": "admin only"}, 403); return
            sub = unquote(path[len("/api/admin/user/"):].strip("/"))
            db = load_users_db()
            u = db["users"].get(sub)
            if not isinstance(u, dict):
                self._send_json({"error": "unknown user"}, 404); return
            s = progress_summary(u.get("progress") or {})
            self._send_json({"user": public_user(u), "summary": s,
                             "progress": u.get("progress") or {}})
            return
        if path.startswith("/cee-img/"):
            self._file(path); return
        # Static asset folders used by the practice engine and the STP viewer.
        if path.startswith("/pdfs/") or path.startswith("/radiology-img/"):
            self._file(path); return
        if path == "/favicon.ico":
            self._send(204, "image/x-icon", b""); return
        self._send(404, "text/plain", b"not found")

    # ---------------- POST ----------------
    # Public routes (usable from LAN too): sign-in / sign-up, progress sync,
    # and the admin password endpoints themselves.
    PUBLIC_POST = ("/api/auth/google", "/api/auth/signup", "/api/auth/login",
                   "/api/auth/logout", "/api/logout", "/api/progress",
                   "/api/session",
                   "/api/admin/login", "/api/admin/logout", "/api/admin/set-password")

    def do_POST(self):
        path = self.path.split("?")[0]
        # Writes always need an admin session. Loopback alone is NOT enough:
        # a tunnel (ngrok, cloudflared) connects from 127.0.0.1, so trusting
        # the peer address would hand the panel to anyone who finds the URL.
        if path not in self.PUBLIC_POST and not admin_session_ok(self):
            self._send_json({"error": "Admin changes need the admin password"}, 403)
            return
        raw = self._body()
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            self._send_json({"error": "bad JSON body"}, 400); return

        # ---------------- admin password ----------------
        if path == "/api/admin/login":
            pw = str(payload.get("password", "") or "")
            rec = load_admin_db().get("pw")
            if not rec:
                self._send_json({"error": "No admin password is set yet. Set one first."}, 400); return
            if not check_password(pw, rec):
                time.sleep(0.4)  # slow down guessing
                self._send_json({"error": "Wrong password."}, 401); return
            sid = create_admin_session()
            self._send_json({"ok": True}, extra={
                "Set-Cookie": "%s=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d"
                % (ADMIN_COOKIE, sid, ADMIN_TTL)})
            return
        if path == "/api/admin/logout":
            sid = self._cookies().get(ADMIN_COOKIE, "")
            if sid:
                db = load_admin_db()
                db["sessions"].pop(sid, None)
                save_admin_db(db)
            self._send_json({"ok": True}, extra={
                "Set-Cookie": "%s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" % ADMIN_COOKIE})
            return
        if path == "/api/admin/set-password":
            pw = str(payload.get("password", "") or "")
            current = str(payload.get("current", "") or "")
            db = load_admin_db()
            if db.get("pw"):
                # changing an existing password needs the old one, or a local session
                if not (admin_session_ok(self) or check_password(current, db["pw"])):
                    self._send_json({"error": "Current password is required."}, 403); return
            if len(pw) < 8:
                self._send_json({"error": "Use at least 8 characters."}, 400); return
            db["pw"] = hash_password(pw)
            db["sessions"] = {}  # signing everyone out is the safe default
            save_admin_db(db)
            sid = create_admin_session()
            self._send_json({"ok": True}, extra={
                "Set-Cookie": "%s=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d"
                % (ADMIN_COOKIE, sid, ADMIN_TTL)})
            return

        # ---------------- public auth + progress endpoints ----------------
        if path == "/api/auth/google":
            token = str(payload.get("credential", "") or "")
            if not token:
                self._send_json({"error": "missing credential"}, 400); return
            try:
                info = verify_google_id_token(token)
            except ValueError as ex:
                self._send_json({"error": str(ex)}, 400); return
            except Exception:
                self._send_json({"error": "could not reach Google to verify the token"}, 502); return
            with _lock:
                db = load_users_db()
                now = int(time.time())
                u = db["users"].setdefault(info["sub"], {"sub": info["sub"], "created": now, "progress": {}})
                u["name"] = info.get("name", "") or u.get("name", "")
                u["email"] = info.get("email", "") or u.get("email", "")
                u["picture"] = info.get("picture", "") or u.get("picture", "")
                u["provider"] = "google"
                u["last_seen"] = now
                sid = create_session(db, info["sub"])
                save_users_db(db)
            self._send_json({"user": public_user(u)}, extra={"Set-Cookie": session_cookie(sid)})
            return

        if path == "/api/auth/signup":
            name = str(payload.get("name", "") or "").strip()[:80]
            email = norm_email(payload.get("email", ""))
            password = str(payload.get("password", "") or "")
            if not name:
                self._send_json({"error": "Please enter your name."}, 400); return
            if not EMAIL_RE.match(email):
                self._send_json({"error": "That e-mail address does not look valid."}, 400); return
            if len(password) < 8:
                self._send_json({"error": "Password must be at least 8 characters."}, 400); return
            sub = email_sub(email)
            with _lock:
                db = load_users_db()
                now = int(time.time())
                existing = db["users"].get(sub)
                if isinstance(existing, dict) and existing.get("pw"):
                    self._send_json({"error": "An account with this e-mail already exists. Sign in instead."}, 409)
                    return
                u = existing if isinstance(existing, dict) else {"sub": sub, "created": now, "progress": {}}
                u.update({"sub": sub, "name": name, "email": email,
                          "provider": "password", "pw": hash_password(password),
                          "created": u.get("created", now), "last_seen": now})
                u.setdefault("progress", {})
                db["users"][sub] = u
                sid = create_session(db, sub)
                save_users_db(db)
            self._send_json({"user": public_user(u)}, extra={"Set-Cookie": session_cookie(sid)})
            return

        if path == "/api/auth/login":
            email = norm_email(payload.get("email", ""))
            password = str(payload.get("password", "") or "")
            sub = email_sub(email)
            with _lock:
                db = load_users_db()
                u = db["users"].get(sub)
                if not isinstance(u, dict) or not check_password(password, u.get("pw") or {}):
                    self._send_json({"error": "Wrong e-mail or password."}, 401); return
                u["last_seen"] = int(time.time())
                sid = create_session(db, sub)
                save_users_db(db)
            self._send_json({"user": public_user(u)}, extra={"Set-Cookie": session_cookie(sid)})
            return

        if path in ("/api/auth/logout", "/api/logout"):
            _user, sid = self._session()
            if sid:
                with _lock:
                    db = load_users_db()
                    db["sessions"].pop(sid, None)
                    save_users_db(db)
            self._send_json({"ok": True}, extra={"Set-Cookie": clear_cookie()})
            return

        if path == "/api/progress":
            user, _sid = self._session()
            if not user:
                self._send_json({"error": "not signed in"}, 401); return
            items = payload.get("progress")
            if not isinstance(items, dict):
                self._send_json({"error": "payload must be {progress:{qid:{c,t}}}"}, 400); return
            now = int(time.time())
            n = 0
            with _lock:
                db = load_users_db()
                u = db["users"].setdefault(user["sub"], {"sub": user["sub"], "progress": {}})
                p = u.setdefault("progress", {})
                for qid, v in items.items():
                    if not isinstance(qid, str) or not qid or len(qid) > 300:
                        continue
                    t = now
                    ok = 0
                    if isinstance(v, dict):
                        try:
                            t = int(v.get("t", now))
                        except (TypeError, ValueError):
                            t = now
                        ok = 1 if v.get("c") else 0
                    prev = p.get(qid)
                    if prev and prev.get("c"):
                        ok = 1  # once solved correctly, always shown as solved
                    p[qid] = {"c": ok, "t": t}
                    n += 1
                save_users_db(db)
            self._send_json({"ok": True, "saved": n})
            return

        if path == "/api/session":
            user, _sid = self._session()
            if not user:
                self._send_json({"error": "not signed in"}, 401); return
            bankId = str(payload.get("bankId") or "").strip()
            session = payload.get("session", None)
            if not bankId:
                self._send_json({"error": "bankId required"}, 400); return
            # cap payload size ~5MB
            try:
                if session is not None and len(json.dumps(session)) > 5 * 1024 * 1024:
                    self._send_json({"error": "session too large"}, 413); return
            except Exception:
                pass
            with _lock:
                db = load_users_db()
                u = db["users"].setdefault(user["sub"], {"sub": user["sub"], "progress": {}, "resume": {}})
                u.setdefault("resume", {})
                if session is None:
                    u["resume"].pop(bankId, None)
                else:
                    u["resume"][bankId] = session
                save_users_db(db)
            self._send_json({"ok": True})
            return

        # ---------------- admin (loopback only) endpoints ----------------
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

        if path == "/api/save-notification":
            content = payload if isinstance(payload, dict) else {}
            try:
                backup = save_notification_content(content)
                self._send_json({"ok": True, "backup": backup, "msg": "saved to index.html · backup " + backup})
            except Exception as ex:
                self._send_json({"error": "save failed: %r" % ex}, 500)
            return

        if path == "/api/save-access-settings":
            enabled = bool(payload.get("enabled"))
            code = str(payload.get("code", ""))
            banks = payload.get("banks", [])
            if banks is None:
                banks = []
            if not isinstance(banks, list):
                self._send_json({"error": "banks must be a list of set ids"}, 400); return
            keep_code = bool(payload.get("keep_code"))
            try:
                stamp = time.strftime("%d %b %Y, %H:%M")
                backup = save_lock(enabled, code, banks, stamp, keep_code=keep_code)
                count = len([b for b in banks if b])
                if enabled and keep_code:
                    msg = ("Lock selection updated to %d set%s (code unchanged) — backup %s"
                           % (count, "" if count == 1 else "s", backup))
                elif enabled:
                    msg = ("Lock set on %d set%s — backup %s"
                           % (count, "" if count == 1 else "s", backup))
                else:
                    msg = "Lock removed — backup " + backup
                self._send_json({"ok": True, "msg": msg})
            except Exception as ex:
                bad = any(t in str(ex) for t in ("code must", "select at least", "unknown bank", "no existing lock"))
                self._send_json({"error": "%r" % ex}, 400 if bad else 500)
            return

        if path == "/api/sub-generate":
            try:
                entry = generate_sub(payload.get("devId"), payload.get("note"))
                self._send_json({"ok": True, "code": entry["code"], "devId": entry["devId"],
                                 "createdAt": entry["createdAt"]})
            except Exception as ex:
                self._send_json({"error": "%s" % ex}, 400)
            return
        if path == "/api/sub-revoke":
            try:
                revoke_sub(payload.get("devId"))
                self._send_json({"ok": True})
            except Exception as ex:
                self._send_json({"error": "%s" % ex}, 400)
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

        if path == "/api/google-config":
            cid = str(payload.get("client_id", "") or "").strip()
            try:
                cfg = save_google_client_id(cid)
                self._send_json({"ok": True, "client_id": cfg.get("client_id", ""),
                                 "msg": ("Google Client ID saved" if cid
                                         else "Google Client ID cleared — sign-in disabled")})
            except Exception as ex:
                self._send_json({"error": "%r" % ex}, 500)
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


