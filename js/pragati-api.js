/* Pragati Bibaran — API bridge + storage adapter.
 *
 * Runs on a static GitHub Pages origin. It keeps the existing MedArena Worker
 * bridge contract, then adds a typed data layer for personal analytics:
 *   - localStorage is always the immediate source of truth on this device
 *   - /api/pragati/* is attempted through the existing Worker (optional)
 *   - Supabase REST is used only when supabase-config.json is configured AND a
 *     user JWT is available, so anon keys alone can never bypass RLS
 */
(function () {
  "use strict";

  /* ---------- 1. Existing MedArena Worker bridge (idempotent) ---------- */
  /* surgery-practice.html already installs the same bridge inline. Reusing it
     avoids wrapping fetch twice or replacing MA_BRIDGE.setBase behaviour. */
  if (!window.__maBridgeInstalled && !window.MA_BRIDGE) {
    window.__maBridgeInstalled = true;
    var ls = "";
    try { ls = (localStorage.getItem("ma_api_base") || "").trim(); } catch (e) {}
    var onLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
    var base = "";
    if (ls === "-") base = "";
    else if (ls) base = ls.replace(/\/$/, "");
    else if (!onLocal) base = String(window.MA_API_BASE || "").replace(/\/$/, "");

    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      if (!/^\/api\//.test(url) || !base) return nativeFetch(input, init);
      var headers = new Headers((init && init.headers) || (input && input.headers) || {});
      var tokenKey = /\/api\/admin/i.test(url) ? "ma_admin_token" : "ma_token";
      var token = "";
      try { token = localStorage.getItem(tokenKey) || ""; } catch (e) {}
      if (token && !headers.has("Authorization")) headers.set("Authorization", "Bearer " + token);
      var opts = Object.assign({}, init || {}, { headers: headers });
      if (base) {
        opts.mode = "cors";
        opts.credentials = "omit";
      }
      return nativeFetch(base + url, opts);
    };
    window.MA_BRIDGE = {
      base: base,
      setBase: function (b) { try { localStorage.setItem("ma_api_base", b || ""); } catch (e) {} },
      clearTokens: function () { try { localStorage.removeItem("ma_token"); localStorage.removeItem("ma_admin_token"); } catch (e) {} }
    };
  }

  /* ---------- 2. Defaults used when config files are unavailable ---------- */
  var DEFAULT_MARKS = {
    medicine: 18, surgery: 18, obg: 12, pediatrics: 12, orthopedics: 10,
    ent: 10, ophthalmology: 7, anesthesia: 7, psychiatry: 7, radiology: 7,
    dermatology: 7, anatomy: 12, physiology: 12, pathology: 10,
    pharmacology: 10, biochemistry: 8, microbiology: 8, community: 6,
    research: 4, forensic: 5, cpd: 10
  };
  var WEIGHT_KEY = "pragati.weightage.v1";
  var CONFIG_URL = "supabase-config.json";
  var SYLLABUS_URL = "pragati-syllabus.json";
  var COUNTS_URL = "pragati-question-counts.json";
  var INDEX_URL = "pragati-question-index.json";

  function safeGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function safeJson(text, fallback) { try { return JSON.parse(text); } catch (e) { return fallback; } }
  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "local-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function identity() {
    try {
      var u = window.MACLOUD && window.MACLOUD.user;
      if (u && (u.sub || u.email)) return String(u.sub || ("pw:" + u.email));
    } catch (e) {}
    var id = safeGet("pragati.localId");
    if (!id) { id = uuid(); safeSet("pragati.localId", id); }
    return id;
  }
  async function getJson(url, fallback) {
    try {
      var r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return fallback;
      return await r.json();
    } catch (e) { return fallback; }
  }

  var _configPromise = null;
  function config() {
    if (!_configPromise) _configPromise = getJson(CONFIG_URL, { enabled: false, url: "", anonKey: "" });
    return _configPromise;
  }

  function defaultSubjects() {
    return Object.keys(DEFAULT_MARKS).map(function (id) {
      return { id: id, marks: DEFAULT_MARKS[id] };
    });
  }

  function normaliseWeightage(raw, source) {
    var byId = {};
    defaultSubjects().forEach(function (s) { byId[s.id] = s.marks; });
    var names = {};
    try {
      var sy = window.PragatiStore && window.PragatiStore._syllabus;
      (sy && sy.subjects || []).forEach(function (s) { names[s.id] = s; });
    } catch (e) {}
    var overriding = (raw && Array.isArray(raw.subjects)) ? raw.subjects : (Array.isArray(raw) ? raw : []);
    overriding.forEach(function (s) {
      if (s && Object.prototype.hasOwnProperty.call(byId, s.id) && Number.isFinite(Number(s.marks))) {
        byId[s.id] = Math.max(0, Math.round(Number(s.marks)));
      }
    });
    var subjects = Object.keys(byId).map(function (id) {
      var meta = names[id] || {};
      return {
        id: id,
        name: meta.name || id,
        nameNp: meta.nameNp || "",
        group: meta.group || "",
        marks: byId[id]
      };
    });
    var total = subjects.reduce(function (a, s) { return a + s.marks; }, 0);
    return { subjects: subjects, total: total, valid: total === 200, source: source || "default" };
  }

  var _weightPromise = null;
  async function getWeightage(force) {
    if (!force && _weightPromise) return _weightPromise;
    _weightPromise = (async function () {
      var local = safeJson(safeGet(WEIGHT_KEY), null);
      var apiData = null;
      try {
        var r = await fetch("/api/pragati/weightage", { cache: "no-store" });
        if (r.ok) apiData = await r.json();
      } catch (e) {}
      var syllabus = await getJson(SYLLABUS_URL, null);
      window.PragatiStore._syllabus = syllabus;
      var base = syllabus || { subjects: defaultSubjects() };
      var merged = normaliseWeightage(base, "blueprint");
      if (apiData) merged = normaliseWeightage(apiData, "server");
      if (local) merged = normaliseWeightage(local, "this device");
      return merged;
    })();
    return _weightPromise;
  }

  async function saveWeightage(subjects) {
    var checked = normaliseWeightage({ subjects: subjects }, "this device");
    if (!checked.valid) return { ok: false, error: "Weightage must total exactly 200 marks (currently " + checked.total + ").", local: false, remote: false };
    var payload = { v: 1, subjects: checked.subjects, total: 200, updatedAt: new Date().toISOString() };
    safeSet(WEIGHT_KEY, JSON.stringify(payload));
    var remote = false, error = "";
    try {
      var r = await fetch("/api/admin/pragati/weightage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      remote = r.ok;
      if (!r.ok) error = "Saved on this device; server sync was rejected (" + r.status + ").";
    } catch (e) { error = "Saved on this device; server sync unavailable here."; }
    _weightPromise = null;
    return { ok: true, local: true, remote: remote, error: error, data: checked };
  }

  function profileKey(key) { return "pragati.profile." + key; }
  function manualKey(key) { return "pragati.manual." + key; }

  function getProfile(key) {
    var p = safeJson(safeGet(profileKey(key)), null);
    if (!p || typeof p !== "object") p = {};
    return p;
  }
  async function saveProfile(key, profile) {
    var payload = Object.assign({}, profile, { userKey: key, updatedAt: new Date().toISOString() });
    safeSet(profileKey(key), JSON.stringify(payload));
    try {
      fetch("/api/pragati/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(function () {});
    } catch (e) {}
    var cfg = await config();
    if (cfg && cfg.enabled && cfg.url && cfg.anonKey) {
      supabaseUpsert(cfg, "pragati_profiles", [{
        user_key: key,
        display_name: String(payload.displayName || "").slice(0, 120),
        target_marks: Number(payload.targetMarks) || 200,
        exam_date: payload.examDate || null,
        daily_minutes: Number(payload.dailyMinutes) || 30,
        min_attempts: Number(payload.minAttempts) || 12,
        goals: payload.goals || [],
        updated_at: payload.updatedAt
      }]).catch(function () {});
    }
    return payload;
  }

  function getManual(key) {
    var m = safeJson(safeGet(manualKey(key)), {});
    return (m && typeof m === "object") ? m : {};
  }
  function setManual(key, subjectId, chapter, completed) {
    var m = getManual(key);
    var k = subjectId + "||" + chapter;
    if (completed) m[k] = { completed: true, at: Date.now() };
    else delete m[k];
    safeSet(manualKey(key), JSON.stringify(m));
    var cfgPromise = config();
    cfgPromise.then(function (cfg) {
      if (!cfg || !cfg.enabled || !cfg.url || !cfg.anonKey) return null;
      return supabaseUpsert(cfg, "pragati_profiles", [{ user_key: key }])
        .catch(function () { return null; })
        .then(function () {
          return supabaseUpsert(cfg, "pragati_chapter_progress", [{
            user_key: key, subject_id: subjectId, chapter: chapter,
            completed: !!completed, completed_at: new Date().toISOString()
          }]).catch(function () { return null; });
        });
    }).catch(function () { return null; });
    return m;
  }

  function supabaseToken(cfg) {
    var ref = "";
    try { ref = new URL(cfg.url).hostname.split(".")[0] || ""; } catch (e) {}
    var keys = ["supabase.access_token", "sb-" + ref + "-auth-token"];
    for (var i = 0; i < keys.length; i++) {
      var raw = safeGet(keys[i]);
      if (!raw) continue;
      var parsed = safeJson(raw, null);
      var tok = parsed && (parsed.access_token || parsed.accessToken);
      if (tok) return tok;
    }
    return "";
  }
  async function supabaseUpsert(cfg, table, rows) {
    if (!rows || !rows.length) return null;
    var token = supabaseToken(cfg);
    if (!token) return null; // RLS requires a real user JWT; do not send anon inserts
    var headers = {
      "Content-Type": "application/json",
      apikey: cfg.anonKey,
      Authorization: "Bearer " + token,
      Prefer: "resolution=merge-duplicates,return=minimal"
    };
    return fetch(String(cfg.url).replace(/\/$/, "") + "/rest/v1/" + table, {
      method: "POST", headers: headers, body: JSON.stringify(rows)
    });
  }

  async function syncRemote(events, sessions) {
    var cfg = await config();
    if (events && events.length) {
      try {
        fetch("/api/pragati/events", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: events })
        }).catch(function () {});
      } catch (e) {}
    }
    if (sessions && sessions.length) {
      try {
        fetch("/api/pragati/sessions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessions: sessions })
        }).catch(function () {});
      } catch (e) {}
    }
    if (cfg && cfg.enabled && cfg.url && cfg.anonKey) {
      // The event/session tables reference a profile row. Create a minimal one
      // first (omitted columns keep their defaults or existing values).
      var keys = {};
      (events || []).concat(sessions || []).forEach(function (row) {
        if (row && row.userKey) keys[row.userKey] = true;
      });
      var profileRows = Object.keys(keys).map(function (k) { return { user_key: k }; });
      if (profileRows.length) {
        try { await supabaseUpsert(cfg, "pragati_profiles", profileRows); } catch (e) {}
      }
      var rows = (events || []).map(function (e) {
        return {
          id: e.id, user_key: e.userKey, bank_id: e.bankId,
          question_key: e.questionKey, subject_id: e.subjectId,
          chapter: e.chapter, selected_keys: e.selected || [],
          is_correct: !!e.correct, first_attempt: !!e.firstAttempt,
          attempted_at: new Date(e.attemptedAt || Date.now()).toISOString(),
          session_id: e.sessionId || null, source: e.source || "practice"
        };
      });
      var srows = (sessions || []).map(function (s) {
        return {
          id: s.id, user_key: s.userKey, bank_id: s.bankId || null,
          label: s.label || null, mode: s.mode || null,
          started_at: s.startedAt ? new Date(s.startedAt).toISOString() : null,
          finished_at: s.finishedAt ? new Date(s.finishedAt).toISOString() : null,
          total: Number(s.total) || 0, answered: Number(s.answered) || 0,
          correct: Number(s.correct) || 0,
          time_used_seconds: Number(s.timeUsed) || 0
        };
      });
      try { await supabaseUpsert(cfg, "pragati_answer_events", rows); } catch (e) {}
      try { await supabaseUpsert(cfg, "pragati_sessions", srows); } catch (e) {}
    }
  }

  window.PragatiStore = {
    DEFAULT_MARKS: DEFAULT_MARKS,
    identity: identity,
    config: config,
    loadSyllabus: function () { return getJson(SYLLABUS_URL, null); },
    loadCounts: function () { return getJson(COUNTS_URL, null); },
    loadIndex: function () { return getJson(INDEX_URL, null); },
    getWeightage: getWeightage,
    saveWeightage: saveWeightage,
    getProfile: getProfile,
    saveProfile: saveProfile,
    getManual: getManual,
    setManual: setManual,
    syncRemote: syncRemote,
    _syllabus: null
  };
})();
