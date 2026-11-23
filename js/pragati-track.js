/* Pragati Bibaran — client-side answer event tracker.
 *
 * Loaded on surgery-practice.html. Every graded answer becomes one immutable
 * event in localStorage. The event log is the source of truth for attempts;
 * unique questions are derived from questionKey so repeats never inflate
 * coverage. Remote writes are best-effort — the local log always survives.
 */
(function () {
  "use strict";

  var EVENT_KEY = "pragati.events.v1";
  var SESSION_KEY = "pragati.sessions.v1";
  var MAX_EVENTS = 12000;
  var MAX_SESSIONS = 600;
  var _syncTimer = null;

  function safeGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function parse(k, fallback) {
    try { var v = JSON.parse(safeGet(k)); return Array.isArray(v) ? v : fallback; } catch (e) { return fallback; }
  }
  function uid(prefix) {
    try { if (crypto && crypto.randomUUID) return prefix + crypto.randomUUID(); } catch (e) {}
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function identity() {
    try {
      var u = window.MACLOUD && window.MACLOUD.user;
      if (u && (u.sub || u.email)) return String(u.sub || ("pw:" + u.email));
    } catch (e) {}
    var id = safeGet("pragati.localId");
    if (!id) { id = uid("local-"); safeSet("pragati.localId", id); }
    return id;
  }
  function migrateIdentity() {
    try {
      var u = window.MACLOUD && window.MACLOUD.user;
      if (!u || !(u.sub || u.email)) return;
      var sub = String(u.sub || ("pw:" + u.email));
      var localId = safeGet("pragati.localId");
      if (!localId || sub === localId) return;
      var evs = parse(EVENT_KEY, []), changed = false;
      evs.forEach(function (e) { if (e && e.userKey === localId) { e.userKey = sub; changed = true; } });
      if (changed) safeSet(EVENT_KEY, JSON.stringify(evs.slice(-MAX_EVENTS)));
      var sess = parse(SESSION_KEY, []);
      changed = false;
      sess.forEach(function (s) { if (s && s.userKey === localId) { s.userKey = sub; changed = true; } });
      if (changed) safeSet(SESSION_KEY, JSON.stringify(sess.slice(-MAX_SESSIONS)));
    } catch (e) {}
  }
  function events() { migrateIdentity(); return parse(EVENT_KEY, []); }
  function sessions() { migrateIdentity(); return parse(SESSION_KEY, []); }
  function mine() {
    var key = identity();
    return events().filter(function (e) { return e && e.userKey === key; });
  }

  function queueSync(eventsDelta, sessionsDelta) {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(function () {
      if (!window.PragatiStore || !window.PragatiStore.syncRemote) return;
      window.PragatiStore.syncRemote(eventsDelta, sessionsDelta).catch(function () {});
    }, 1400);
  }

  function recordAnswer(question, opts) {
    opts = opts || {};
    var T = window.PragatiTaxonomy;
    if (!T || !question) return null;
    var mapped = T.mapQuestion(opts.bankId, question);
    var key = identity();
    var prior = events().filter(function (e) { return e && e.userKey === key && e.questionKey === mapped.questionKey; });
    var evt = {
      id: uid("evt_"),
      userKey: key,
      bankId: mapped.bankId,
      questionKey: mapped.questionKey,
      subjectId: mapped.subjectId,
      chapter: mapped.chapter,
      selected: Array.isArray(opts.selected) ? opts.selected.slice() : [],
      correct: !!opts.correct,
      firstAttempt: prior.length === 0,
      attemptedAt: opts.attemptedAt || Date.now(),
      sessionId: opts.sessionId || null,
      mode: opts.mode || "tutor",
      source: opts.source || "practice"
    };
    var all = events();
    all.push(evt);
    safeSet(EVENT_KEY, JSON.stringify(all.slice(-MAX_EVENTS)));
    queueSync([evt], []);
    return evt;
  }

  function startSession(meta) {
    meta = meta || {};
    var s = {
      id: uid("sess_"),
      userKey: identity(),
      bankId: meta.bankId || "",
      label: meta.label || "",
      mode: meta.mode || "",
      startedAt: meta.startedAt || Date.now(),
      finishedAt: null,
      total: Number(meta.total) || 0,
      answered: 0,
      correct: 0,
      timeUsed: 0
    };
    var all = sessions();
    all.push(s);
    safeSet(SESSION_KEY, JSON.stringify(all.slice(-MAX_SESSIONS)));
    try { sessionStorage.setItem("pragati.currentSession", s.id); } catch (e) {}
    return s;
  }

  function finishSession(summary) {
    summary = summary || {};
    var id = summary.id;
    try { if (!id) id = sessionStorage.getItem("pragati.currentSession"); } catch (e) {}
    if (!id) return null;
    var all = sessions(), found = null;
    all.forEach(function (s) {
      if (s && s.id === id) {
        s.finishedAt = summary.finishedAt || Date.now();
        s.answered = Number(summary.answered) || 0;
        s.correct = Number(summary.correct) || 0;
        s.timeUsed = Number(summary.timeUsed) || 0;
        found = s;
      }
    });
    safeSet(SESSION_KEY, JSON.stringify(all.slice(-MAX_SESSIONS)));
    if (found) queueSync([], [found]);
    try { sessionStorage.removeItem("pragati.currentSession"); } catch (e) {}
    return found;
  }

  /* Legacy solved map backfill. These rows are real activity, but carry no
     selected options and no subject for unmapped mixed banks. They are merged
     in memory by the dashboard only when no newer event exists for the key. */
  function legacyEvents() {
    var solved = {};
    try { solved = JSON.parse(safeGet("medarena.solved") || "{}") || {}; } catch (e) {}
    var realKeys = {};
    events().forEach(function (e) { if (e && e.questionKey) realKeys[e.questionKey] = true; });
    var idx = null;
    try { idx = JSON.parse(safeGet("pragati.indexCache") || "null"); } catch (e) {}
    var out = [];
    Object.keys(solved).forEach(function (qid) {
      if (realKeys[qid]) return;
      var v = solved[qid] || {};
      var bankId = String(qid).split("|")[0] || "";
      var subjectId = "mixed", chapter = "Legacy solved question";
      if (idx && idx.items && window.PragatiTaxonomy) {
        var hit = idx.items[window.PragatiTaxonomy.hashKey(qid)];
        if (hit && hit[0] >= 0) {
          subjectId = idx.subjectIds[hit[0]] || "mixed";
          chapter = (idx.chapterNames[subjectId] || [])[hit[1]] || chapter;
        }
      }
      out.push({
        id: "legacy_" + window.PragatiTaxonomy.hashKey(qid),
        userKey: identity(), bankId: bankId, questionKey: qid,
        subjectId: subjectId, chapter: chapter, selected: [],
        correct: v.c === 1, firstAttempt: true,
        attemptedAt: Number(v.t) || 0, sessionId: null,
        mode: "legacy", source: "medarena.solved"
      });
    });
    return out;
  }

  function cacheIndex(idx) { if (idx) safeSet("pragati.indexCache", JSON.stringify(idx)); }

  window.PragatiTrack = {
    identity: identity,
    events: events,
    sessions: sessions,
    mine: mine,
    recordAnswer: recordAnswer,
    startSession: startSession,
    finishSession: finishSession,
    legacyEvents: legacyEvents,
    cacheIndex: cacheIndex
  };
})();
