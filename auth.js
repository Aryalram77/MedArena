/* ============ MedArena — accounts, sign-in + per-user progress ============ */
/* Loaded on index.html and surgery-practice.html.
   - Solved-question points are recorded locally ("medarena.solved") immediately.
   - Signed in (Google or e-mail + password, server on http://localhost:8600),
     points merge with the account's cloud progress (medarena-users.json).
   - Server: /api/auth/config, /api/auth/google, /api/auth/signup,
     /api/auth/login, /api/auth/logout, /api/me, /api/progress (GET+POST). */
(function () {
"use strict";

const maEl = id => document.getElementById(id);
const maEsc = t => (t ?? "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function maToast(m) {
  try { if (typeof toast === "function") { toast(m); return; } } catch (e) {}
  console.log("[MedArena]", m);
}

/* tiny safe storage (page's own `store` wrapper may not exist on index.html) */
const MA = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return (window.__maMem && window.__maMem[k]) || ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { window.__maMem = window.__maMem || {}; window.__maMem[k] = v; } }
};

const CLOUD = { online: false, clientId: "", user: null, gsi: 0, gsiInit: false, pending: {}, banks: null };
window.MACLOUD = CLOUD;
window.maSyncCloud = null;   // set below; practice-page hooks guard on it

/* solved-question map: qid = bankId + "|" + stem.slice(0,120); value {c:0|1, t} */
let MASOLVED = {};
try { MASOLVED = JSON.parse(MA.get("medarena.solved") || "{}"); } catch (e) { MASOLVED = {}; }
if (!MASOLVED || typeof MASOLVED !== "object") MASOLVED = {};

function maSaveSolved() { MA.set("medarena.solved", JSON.stringify(MASOLVED)); }

function maMark(items) {
  const now = Date.now();
  for (const qid of Object.keys(items)) {
    const v = items[qid] || {};
    const prev = MASOLVED[qid];
    const c = (v.c === 1) || (prev && prev.c === 1) ? 1 : 0;
    MASOLVED[qid] = { c, t: Math.max(v.t || 0, (prev && prev.t) || 0) || now };
  }
  maSaveSolved();
}

/* debounced cloud flush; retries keep failed payloads */
let _maFlushT = null;
function maSyncCloud(items) {
  if (!items || !Object.keys(items).length) return;
  maMark(items);
  try { maUpdateCards(); } catch (e) {}
  if (!CLOUD.user || !CLOUD.online) return;      // local-only until signed in
  Object.assign(CLOUD.pending, items);
  clearTimeout(_maFlushT);
  _maFlushT = setTimeout(maFlush, 1200);
}
window.maSyncCloud = maSyncCloud;

function maFlush() {
  if (!CLOUD.user || !CLOUD.online) return;
  const items = CLOUD.pending;
  if (!Object.keys(items).length) return;
  CLOUD.pending = {};
  fetch("/api/progress", {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "same-origin", body: JSON.stringify({ progress: items })
  }).then(r => { if (r.ok) { try { maUpdateCards(); } catch (e) {} } return r; })
    .then(r => { if (r && !r.ok) throw 0; })
    .catch(() => {
      CLOUD.pending = Object.assign({}, items, CLOUD.pending);
      clearTimeout(_maFlushT);
      _maFlushT = setTimeout(maFlush, 15000);
    });
}

/* ---------------- stats ---------------- */
function maStats() {
  let solved = 0, correct = 0;
  for (const qid in MASOLVED) { solved++; if (MASOLVED[qid] && MASOLVED[qid].c === 1) correct++; }
  return { solved, correct, accuracy: solved ? Math.round(correct * 100 / solved) : 0 };
}
function maBankCount(id) {
  const pref = id + "|";
  let solved = 0, correct = 0;
  for (const qid in MASOLVED) if (qid.indexOf(pref) === 0) { solved++; if (MASOLVED[qid] && MASOLVED[qid].c === 1) correct++; }
  return { solved, correct };
}
/* bank id -> {name, count} from the server (cached), else the page's BANKS */
function maBankMeta() {
  if (CLOUD.banks) return CLOUD.banks;
  const out = {};
  try {
    if (typeof BANKS !== "undefined" && Array.isArray(BANKS)) {
      BANKS.forEach(e => { out[e.id] = { name: (e.bank && e.bank.name) || e.id, count: (e.bank && e.bank.questions || []).length }; });
      return out;
    }
  } catch (e) {}
  document.querySelectorAll("a.home-bank-action").forEach(a => {
    const m = /bank=([\w-]+)/.exec(a.getAttribute("href") || "");
    if (!m || out[m[1]]) return;
    const card = a.closest(".home-bank-card");
    const nameEl = card && card.querySelector(".home-bank-name");
    const cntEl = card && card.querySelector(".home-bank-meta b");
    out[m[1]] = {
      name: nameEl ? nameEl.textContent.trim() : m[1],
      count: cntEl ? parseInt(cntEl.textContent.replace(/[^\d]/g, ""), 10) || 0 : 0
    };
  });
  return out;
}
async function maLoadBankMeta() {
  try {
    const r = await fetch("/api/banks", { cache: "no-store" });
    if (!r.ok) return;
    const list = await r.json();
    if (!Array.isArray(list)) return;
    const out = {};
    list.forEach(b => { out[b.id] = { name: b.name || b.id, count: Number(b.count) || 0 }; });
    CLOUD.banks = out;
    try { maUpdateCards(); } catch (e) {}
  } catch (e) {}
}

/* home-page card meta: "· Y solved (X ✔)" */
function maUpdateCards() {
  const meta = maBankMeta();
  document.querySelectorAll("a.home-bank-action").forEach(a => {
    const m = /bank=([\w-]+)/.exec(a.getAttribute("href") || "");
    if (!m) return;
    const card = a.closest(".home-bank-card");
    const metaEl = card && card.querySelector(".home-bank-meta");
    if (!metaEl) return;
    const n = maBankCount(m[1]);
    const tag = metaEl.querySelector(".ma-solved");
    if (!n.solved) { if (tag) tag.remove(); return; }
    const total = (meta[m[1]] || {}).count || 0;
    const txt = "· " + n.solved + (total ? "/" + total : "") + " solved" +
      (n.correct && n.correct !== n.solved ? " (" + n.correct + " \u2714)" : "");
    if (tag) tag.textContent = txt;
    else {
      const s = document.createElement("span");
      s.className = "ma-solved";
      s.style.cssText = "color:#15803d;font-weight:700";
      s.textContent = txt;
      metaEl.appendChild(s);
    }
  });
}
window.maUpdateCards = maUpdateCards;

/* ---------------- modal ---------------- */
let maView = "", maErr = "", maMsg = "", maResetToken = "", maInitDone = false;
function maModal() {
  let ov = maEl("maOverlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "maOverlay";
    ov.innerHTML = '<div id="maBox" role="dialog" aria-modal="true"></div>';
    ov.addEventListener("mousedown", e => { if (e.target === ov) maClose(); });
    document.body.appendChild(ov);
  }
  return ov;
}
function maClose() { const ov = maEl("maOverlay"); if (ov) ov.classList.remove("show"); maView = ""; maErr = ""; maMsg = ""; }
function maOpen(view) { maView = view; maErr = ""; maMsg = ""; maModal().classList.add("show"); maRender(); }

function maRender() {
  const box = maEl("maBox"); if (!box) return;
  let html = '<button class="ma-x" data-ma-close aria-label="Close">\u2715</button>';
  if (maView === "signin") html += maHtmlSignin();
  else if (maView === "signup") html += maHtmlSignup();
  else if (maView === "acct") html += maHtmlAcct();
  else if (maView === "forgot") html += maHtmlForgot();
  else if (maView === "reset") html += maHtmlReset();
  else html += maHtmlProg();
  box.innerHTML = html;

  box.querySelectorAll("[data-ma-out]").forEach(b => { b.onclick = maSignOut; });
  const go = (attr, view) => box.querySelectorAll("[" + attr + "]").forEach(b => { b.onclick = () => { if (attr === "data-ma-signin") maResetToken = ""; maOpen(view); }; });
  go("data-ma-prog", "prog"); go("data-ma-acct", "acct");
  go("data-ma-signin", "signin"); go("data-ma-signup", "signup");
  go("data-ma-forgot", "forgot");
  box.querySelectorAll("[data-ma-close]").forEach(b => { b.onclick = maClose; });

  const lf = maEl("maLoginForm");
  if (lf) lf.onsubmit = maSubmitLogin;
  const sf = maEl("maSignupForm");
  if (sf) sf.onsubmit = maSubmitSignup;
  const ff = maEl("maForgotForm");
  if (ff) ff.onsubmit = maSubmitForgot;
  const rf = maEl("maResetForm");
  if (rf) rf.onsubmit = maSubmitReset;

  if (maView === "signin" && CLOUD.online && CLOUD.clientId) {
    maEnsureGsi(err => {
      const el = maEl("maGsiBtn");
      if (!el) return;
      if (err) {
        el.innerHTML = '<span style="color:#b91c1c;font-size:12.5px">Google sign-in could not load — check internet access, then reopen.</span>';
        return;
      }
      el.innerHTML = "";
      google.accounts.id.renderButton(el, { theme: "outline", size: "large", shape: "pill", text: "continue_with", logo_alignment: "left", width: 300 });
    });
  }
}

function maErrBox() {
  return maErr ? '<div class="ma-err">' + maEsc(maErr) + '</div>' : "";
}
function maMsgBox() {
  return maMsg ? '<div class="ma-note"><b>' + maEsc(maMsg) + '</b></div>' : "";
}

function maHtmlSignin() {
  let note = "";
  if (!CLOUD.online) {
    note = '<div class="ma-note"><b>Server not detected.</b> Start <b>start-admin.bat</b> and open the app at <b>http://localhost:8600</b> to sign in. Your progress is still saved on this device.</div>';
  } else if (!CLOUD.clientId) {
    note = '<div class="ma-note"><b>Google sign-in is not configured yet.</b> E-mail sign-in below works right now. To enable Google, open the admin panel (<b>/admin</b>) and paste a Google OAuth Client ID (Authorized JavaScript origin <code>http://localhost:8600</code>).</div>';
  } else if (location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    note = '<div class="ma-note">Google only allows sign-in from <code>http://localhost:8600</code> (or HTTPS). Open the app from the host computer at <b>http://localhost:8600</b>.</div>';
  }
  let inner = '<h2>Sign in to MedArena</h2>' +
    '<p>Your solved-question progress, correct counts and accuracy stay tied to your account.</p>';
  if (CLOUD.online && CLOUD.clientId) {
    inner += '<div class="ma-gwrap" id="maGsiBtn"><span style="color:#64748b;font-size:12.5px">Loading Google sign-in\u2026</span></div>' +
             '<div class="ma-or"><span>or use your e-mail</span></div>';
  }
  inner += maErrBox();
  if (CLOUD.online) {
    inner += '<form id="maLoginForm" autocomplete="on">' +
      '<label class="ma-f">E-mail<input type="email" id="maEmail" name="email" autocomplete="username" required placeholder="you@example.com"></label>' +
      '<label class="ma-f">Password<input type="password" id="maPass" name="password" autocomplete="current-password" required placeholder="Your password"></label>' +
      '<button class="ma-btn primary ma-wide" type="submit">Sign in</button>' +
      '<button type="button" class="ma-forgot" data-ma-forgot>Forgot password?</button>' +
      '</form>';
  }
  inner += note;
  inner += '<div class="ma-act"><button class="ma-btn" data-ma-signup>New here? Create an account</button>' +
           '<button class="ma-btn" data-ma-close>Continue without an account</button></div>';
  inner += '<p style="margin-bottom:0">Practising without an account keeps progress in this browser; it merges into your account when you sign in.</p>';
  return inner;
}

function maHtmlSignup() {
  let note = "";
  if (!CLOUD.online) {
    note = '<div class="ma-note"><b>Server not detected.</b> Start <b>start-admin.bat</b> and open the app at <b>http://localhost:8600</b> to create an account.</div>';
  }
  return '<h2>Create your MedArena account</h2>' +
    '<p>One account keeps your progress on every device you sign in from.</p>' +
    maErrBox() +
    '<form id="maSignupForm" autocomplete="on">' +
    '<label class="ma-f">Full name<input type="text" id="maName" name="name" autocomplete="name" maxlength="80" required placeholder="Dr. Your Name"></label>' +
    '<label class="ma-f">E-mail<input type="email" id="maEmail" name="email" autocomplete="username" required placeholder="you@example.com"></label>' +
    '<label class="ma-f">Password<input type="password" id="maPass" name="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></label>' +
    '<label class="ma-f">Repeat password<input type="password" id="maPass2" name="password2" autocomplete="new-password" minlength="8" required placeholder="Same password again"></label>' +
    '<button class="ma-btn primary ma-wide" type="submit">Create account</button>' +
    '</form>' + note +
    '<div class="ma-act"><button class="ma-btn" data-ma-signin>I already have an account</button>' +
    '<button class="ma-btn" data-ma-close>Close</button></div>';
}

function maHtmlForgot() {
  let note = "";
  if (!CLOUD.online) {
    note = '<div class="ma-note"><b>Server not detected.</b> Password reset needs the cloud server — try again at <b>' + document.location.origin + '</b>.</div>';
  }
  return '<h2>Reset your password</h2>' +
    '<p>Enter the e-mail you sign in with. If it has an account, a one-time reset link is e-mailed to you (valid for 30 minutes).</p>' +
    maMsgBox() + maErrBox() +
    '<form id="maForgotForm" autocomplete="off">' +
    '<label class="ma-f">E-mail<input type="email" id="maForgotEmail" name="email" autocomplete="username" required placeholder="you@example.com"></label>' +
    '<button class="ma-btn primary ma-wide" type="submit">E-mail me a reset link</button>' +
    '</form>' + note +
    '<div class="ma-act"><button class="ma-btn" data-ma-signin>Back to sign in</button>' +
    '<button class="ma-btn" data-ma-close>Close</button></div>';
}

function maHtmlReset() {
  if (!maResetToken) {
    return '<h2>Set a new password</h2>' +
      '<p class="ma-note">This reset link is missing its token. Use "Forgot password?" on the sign-in panel to get a fresh one.</p>' +
      '<div class="ma-act"><button class="ma-btn" data-ma-signin>Back to sign in</button><button class="ma-btn" data-ma-close>Close</button></div>';
  }
  return '<h2>Set a new password</h2>' +
    '<p>Your reset link is valid — choose a new password (at least 8 characters). You will be signed in automatically.</p>' +
    maErrBox() +
    '<form id="maResetForm" autocomplete="off">' +
    '<label class="ma-f">New password<input type="password" id="maNewPass" name="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></label>' +
    '<label class="ma-f">Repeat password<input type="password" id="maNewPass2" name="password2" autocomplete="new-password" minlength="8" required placeholder="Same password again"></label>' +
    '<button class="ma-btn primary ma-wide" type="submit">Set password</button>' +
    '</form>' +
    '<div class="ma-act"><button class="ma-btn" data-ma-close>Close</button></div>';
}

function maHtmlAcct() {
  const u = CLOUD.user || {};
  const pic = u.picture ? '<img class="av" alt="" src="' + maEsc(u.picture) + '" referrerpolicy="no-referrer">'
                        : '<span class="av">' + maEsc((u.name || u.email || "A").slice(0, 1).toUpperCase()) + '</span>';
  const st = maStats();
  const prov = u.provider === "password" ? "E-mail account" : "Google account";
  return '<h2>Your account</h2>' +
    '<div class="ma-user">' + pic + '<div><b>' + maEsc(u.name || "Account") + '</b><span>' + maEsc(u.email || "") + '</span><span class="ma-prov">' + prov + '</span></div></div>' +
    '<div class="ma-stats"><div><b>' + st.solved + '</b><span>solved</span></div><div><b>' + st.correct + '</b><span>correct</span></div><div><b>' + st.accuracy + '%</b><span>accuracy</span></div></div>' +
    '<div class="ma-act"><button class="ma-btn primary" data-ma-prog>My progress</button><button class="ma-btn" data-ma-out>Sign out</button><button class="ma-btn" data-ma-close>Close</button></div>' +
    '<p style="margin-top:14px;margin-bottom:0">New progress syncs automatically after each practice block, and locally-saved history merges whenever you sign in.</p>';
}

function maHtmlProg() {
  const st = maStats();
  const meta = maBankMeta();
  const rows = Object.keys(meta).map(id => {
    const n = maBankCount(id);
    if (!n.solved) return "";
    const total = meta[id].count || 0;
    const pct = total ? Math.min(100, Math.round(n.solved * 100 / total)) : 0;
    const acc = n.solved ? Math.round(n.correct * 100 / n.solved) : 0;
    return '<div class="ma-brow">' +
      '<div class="ma-btop"><span>' + maEsc(meta[id].name) + '</span>' +
      '<b>' + n.solved + (total ? "/" + total : "") + ' \u00b7 ' + acc + '%</b></div>' +
      (total ? '<div class="ma-bar"><i style="width:' + pct + '%"></i></div>' : '') +
      '</div>';
  }).join("");
  const syncTxt = CLOUD.user
    ? (CLOUD.online ? "\u2705 Synced with your account" : "Offline \u2014 new changes will sync later")
    : "Saved on this device only (not signed in)";
  return '<h2>My progress</h2>' +
    '<div class="ma-stats"><div><b>' + st.solved + '</b><span>solved</span></div><div><b>' + st.correct + '</b><span>correct</span></div><div><b>' + st.accuracy + '%</b><span>accuracy</span></div></div>' +
    (rows ? '<div class="ma-banks">' + rows + '</div>' : '<p>No solved questions yet \u2014 finish a practice block or use tutor mode.</p>') +
    '<p style="margin-top:12px">' + syncTxt + '</p>' +
    '<div class="ma-act">' + (CLOUD.user
      ? '<button class="ma-btn" data-ma-acct>Back</button>'
      : '<button class="ma-btn primary" data-ma-signin>Sign in</button>') +
      '<button class="ma-btn" data-ma-close>Close</button></div>';
}

/* ---------------- sign-in flow ---------------- */
function maPost(url, body) {
  return fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "same-origin", body: JSON.stringify(body || {})
  }).then(async r => {
    let d = {};
    try { d = await r.json(); } catch (e) {}
    // cloud mode: the Worker returns a bearer token — keep it for this device
    if (r.ok && d.token) { try { localStorage.setItem("ma_token", d.token); } catch (e) {} }
    return { ok: r.ok, data: d };
  });
}

function maSubmitLogin(e) {
  e.preventDefault();
  const email = (maEl("maEmail") || {}).value || "";
  const pass = (maEl("maPass") || {}).value || "";
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "Signing in\u2026"; }
  maPost("/api/auth/login", { email, password: pass })
    .then(r => {
      if (r.ok && r.data.user) return maAfterSignin(r.data.user, false);
      maErr = r.data.error || "Sign-in failed.";
      maRender();
    })
    .catch(() => { maErr = "Network error during sign-in."; maRender(); });
}

function maSubmitSignup(e) {
  e.preventDefault();
  const name = (maEl("maName") || {}).value || "";
  const email = (maEl("maEmail") || {}).value || "";
  const pass = (maEl("maPass") || {}).value || "";
  const pass2 = (maEl("maPass2") || {}).value || "";
  if (pass !== pass2) { maErr = "The two passwords do not match."; maRender(); return; }
  if (pass.length < 8) { maErr = "Password must be at least 8 characters."; maRender(); return; }
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "Creating\u2026"; }
  maPost("/api/auth/signup", { name, email, password: pass })
    .then(r => {
      if (r.ok && r.data.user) return maAfterSignin(r.data.user, false);
      maErr = r.data.error || "Could not create the account.";
      maRender();
    })
    .catch(() => { maErr = "Network error while creating the account."; maRender(); });
}

function maEnsureGsi(cb) {
  if (!CLOUD.online) { cb(new Error("offline")); return; }
  if (!CLOUD.clientId) { cb(new Error("noconfig")); return; }
  if (CLOUD.gsi === 2 && window.google && window.google.accounts) { maGsiInit(); cb(null); return; }
  if (CLOUD.gsi === 0) {
    CLOUD.gsi = 1;
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => { CLOUD.gsi = 2; };
    s.onerror = () => { CLOUD.gsi = 3; };
    document.head.appendChild(s);
  }
  const start = Date.now();
  const t = setInterval(() => {
    if ((CLOUD.gsi === 2 && window.google && window.google.accounts) || CLOUD.gsi === 3 || Date.now() - start > 12000) {
      clearInterval(t);
      if (CLOUD.gsi === 2 && window.google && window.google.accounts) { maGsiInit(); cb(null); }
      else cb(new Error(CLOUD.gsi === 3 ? "gsi-failed" : "gsi-timeout"));
    }
  }, 200);
}
function maGsiInit() {
  if (!CLOUD.gsiInit) {
    window.google.accounts.id.initialize({ client_id: CLOUD.clientId, callback: maCredential });
    CLOUD.gsiInit = true;
  }
}
function maCredential(resp) {
  if (!resp || !resp.credential) { maToast("Google sign-in was cancelled."); return; }
  maPost("/api/auth/google", { credential: resp.credential })
    .then(r => { if (r.ok && r.data.user) maAfterSignin(r.data.user, false); else maToast(r.data.error || "Sign-in failed."); })
    .catch(() => maToast("Network error during sign-in."));
}

function maSubmitForgot(e) {
  e.preventDefault();
  const email = (maEl("maForgotEmail") || {}).value || "";
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "Sending\u2026"; }
  maPost("/api/auth/forgot", { email })
    .then(r => {
      if (btn) { btn.disabled = false; btn.textContent = "E-mail me a reset link"; }
      maErr = "";
      maMsg = r.data.msg || "If that e-mail has an account, a reset link is on its way.";
      maRender();
    })
    .catch(() => { maErr = "Network error — check your connection and try again."; maRender(); });
}

function maSubmitReset(e) {
  e.preventDefault();
  const a = (maEl("maNewPass") || {}).value || "";
  const b2 = (maEl("maNewPass2") || {}).value || "";
  if (a !== b2) { maErr = "The two passwords do not match."; maRender(); return; }
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "Setting\u2026"; }
  maPost("/api/auth/reset", { token: maResetToken, password: a })
    .then(r => {
      if (btn) { btn.disabled = false; btn.textContent = "Set password"; }
      if (r.ok && r.data.user) {
        maResetToken = "";
        try { history.replaceState(null, "", location.pathname + location.search); } catch (err) {}
        return maAfterSignin(r.data.user, false);
      }
      maErr = r.data.error || "Could not set the password.";
      maRender();
    })
    .catch(() => { maErr = "Network error — the link may have expired. Request a new one."; maRender(); });
}

/* reset link from the e-mail: /#reset=TOKEN opens the reset panel automatically */
function maMaybeOpenReset() {
  let h = "";
  try { h = location.hash || ""; } catch (e) {}
  if (h.indexOf("#reset=") !== 0) return false;
  maResetToken = decodeURIComponent(h.slice(7));
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  maOpen("reset");
  return true;
}

/* ---------------- adopt a signed-in session: merge cloud progress with local ---------------- */
async function maAfterSignin(user, quiet) {
  CLOUD.user = user;
  let server = {};
  try {
    const r = await fetch("/api/progress", { cache: "no-store" });
    if (r.ok) server = (await r.json()).progress || {};
  } catch (e) {}
  const merged = {};
  for (const qid of Object.keys(server)) {
    const v = server[qid];
    merged[qid] = { c: v && v.c === 1 ? 1 : 0, t: (v && v.t) || 0 };
  }
  const push = {};
  for (const qid of Object.keys(MASOLVED)) {
    const L = MASOLVED[qid]; const S = server[qid];
    if (!S) { merged[qid] = { c: L && L.c === 1 ? 1 : 0, t: (L && L.t) || Date.now() }; push[qid] = merged[qid]; }
    else if (L && L.c === 1 && S.c !== 1) { merged[qid] = { c: 1, t: Math.max(S.t || 0, (L && L.t) || 0) }; push[qid] = merged[qid]; }
  }
  MASOLVED = merged;
  maSaveSolved();
  if (Object.keys(push).length) { CLOUD.pending = push; maFlush(); }
  maErr = "";
  maRenderChip();
  try { maUpdateCards(); } catch (e) {}
  maClose();
  if (!quiet) maToast("\u2705 Signed in \u2014 " + (user.name || user.email || ""));
  maShowProgressCard();
}

function maSignOut() {
  fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  try { localStorage.removeItem("ma_token"); } catch (e) {}
  CLOUD.user = null;
  maRenderChip();
  maOpen("signin");
  maShowProgressCard();
  maToast("Signed out. Local progress kept on this device.");
}

/* ---------------- header chip ---------------- */
function maRenderChip() {
  const hdr = document.querySelector("header");
  if (!hdr) return;
  let chip = maEl("maChip");
  if (!chip) { chip = document.createElement("div"); chip.id = "maChip"; chip.className = "hdr-auth"; hdr.appendChild(chip); }
  if (CLOUD.user) {
    const u = CLOUD.user;
    const nm = u.name || u.email || "Account";
    chip.innerHTML = '<button class="auth-btn" id="maChipBtn">' +
      (u.picture ? '<img class="av avimg" alt="" src="' + maEsc(u.picture) + '" referrerpolicy="no-referrer">'
                 : '<span class="av">' + maEsc(nm.slice(0, 1).toUpperCase()) + '</span>') +
      '<span class="nm">' + maEsc(nm) + '</span></button>';
  } else if (maInitDone && !CLOUD.online) {
    chip.innerHTML = '<span class="auth-btn" style="cursor:default;opacity:.8">💾 Offline — progress saved on this device</span>';
  } else {
    chip.innerHTML = '<button class="auth-btn" id="maChipBtn">\ud83d\udc64 Sign in</button>';
  }
  const btn = maEl("maChipBtn");
  if (btn) btn.onclick = () => maOpen(CLOUD.user ? "acct" : "signin");
}

/* ---------------- post-login progress card (homepage) ---------------- */
function maShowProgressCard() {
  const host = maEl("maProgressHost");
  if (!host) return;
  if (!CLOUD.user) { host.innerHTML = ""; host.hidden = true; return; }
  const u = CLOUD.user, st = maStats(), meta = maBankMeta();
  const rows = Object.keys(meta).map(id => {
    const n = maBankCount(id);
    if (!n.solved) return "";
    const total = meta[id].count || 0;
    const pct = total ? Math.min(100, Math.round(n.solved * 100 / total)) : 0;
    const acc = n.solved ? Math.round(n.correct * 100 / n.solved) : 0;
    return '<a class="mp-row" href="surgery-practice.html?bank=' + encodeURIComponent(id) + '">' +
      '<span class="mp-name">' + maEsc(meta[id].name) + '</span>' +
      '<span class="mp-bar"><i style="width:' + pct + '%"></i></span>' +
      '<span class="mp-num">' + n.solved + (total ? "/" + total : "") + '</span>' +
      '<span class="mp-acc">' + acc + '%</span></a>';
  }).join("");
  host.hidden = false;
  host.innerHTML =
    '<div class="mp-head">' +
      '<div class="mp-id">' +
        (u.picture ? '<img class="mp-av" alt="" src="' + maEsc(u.picture) + '" referrerpolicy="no-referrer">'
                   : '<span class="mp-av">' + maEsc((u.name || u.email || "A").slice(0, 1).toUpperCase()) + '</span>') +
        '<div><div class="mp-eyebrow">WELCOME BACK</div><b>' + maEsc(u.name || u.email || "Account") + '</b></div>' +
      '</div>' +
      '<div class="mp-stats">' +
        '<div><b>' + st.solved + '</b><span>solved</span></div>' +
        '<div><b>' + st.correct + '</b><span>correct</span></div>' +
        '<div><b>' + st.accuracy + '%</b><span>accuracy</span></div>' +
      '</div>' +
    '</div>' +
    (rows ? '<div class="mp-rows"><div class="mp-row mp-hd"><span class="mp-name">Bank</span><span class="mp-bar"></span><span class="mp-num">Solved</span><span class="mp-acc">Acc.</span></div>' + rows + '</div>'
          : '<p class="mp-empty">No solved questions yet \u2014 pick a bank below and finish a practice block to start your progress.</p>') +
    '<div class="mp-foot">' + (CLOUD.online ? "Synced with your account" : "Offline \u2014 changes sync later") +
      ' \u00b7 <button class="mp-link" id="mpAcct">Account</button> \u00b7 <button class="mp-link" id="mpOut">Sign out</button></div>';
  const a = maEl("mpAcct"); if (a) a.onclick = () => maOpen("acct");
  const o = maEl("mpOut"); if (o) o.onclick = maSignOut;
}
window.maShowProgressCard = maShowProgressCard;

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { const ov = maEl("maOverlay"); if (ov && ov.classList.contains("show")) maClose(); }
});

/* ---------------- boot ---------------- */
async function maInit() {
  try {
    const r = await fetch("/api/auth/config", { cache: "no-store" });
    if (r.ok) { const cfg = await r.json(); CLOUD.online = true; CLOUD.clientId = cfg.client_id || ""; }
  } catch (e) {}
  maInitDone = true;
  if (maMaybeOpenReset()) return;
  maRenderChip();
  try { maUpdateCards(); } catch (e) {}
  if (CLOUD.online) {
    maLoadBankMeta();
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      const d = await r.json();
      if (d.user) await maAfterSignin(d.user, true);
      else { maRenderChip(); maShowProgressCard(); }
    } catch (e) { maRenderChip(); maShowProgressCard(); }
  } else {
    maShowProgressCard();
  }
}
maInit();
})();

