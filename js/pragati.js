/* Pragati Bibaran — dashboard renderer.
 * No demo data: all figures are derived from the signed-in user's event log,
 * the existing local progress stores, or configured blueprint metadata.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var T = window.PragatiTaxonomy;
  var Store = window.PragatiStore;
  var Track = window.PragatiTrack;
  var state = {
    user: null, key: "", profile: {}, subjects: [], weightage: null,
    counts: null, events: [], total: {}, manual: {}, cfg: null
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function pct(n) { return (Number(n) || 0).toFixed(1) + "%"; }
  function dayKey(ts) {
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function shiftDay(key, delta) {
    var p = String(key).split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + delta);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function toast(msg) {
    var t = $("pbToast"); if (!t) return;
    t.textContent = msg; t.style.display = "block";
    clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = "none"; }, 3200);
  }
  function waitForAuth(maxMs) {
    return new Promise(function (resolve) {
      var started = Date.now();
      (function poll() {
        try {
          if (window.MACLOUD && window.MACLOUD.user) return resolve(window.MACLOUD.user);
        } catch (e) {}
        if (Date.now() - started > (maxMs || 2200)) return resolve(null);
        setTimeout(poll, 90);
      })();
    });
  }
  function readStore(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }

  async function load() {
    state.subjects = (await Store.loadSyllabus()) || null;
    if (!state.subjects || !Array.isArray(state.subjects.subjects)) {
      state.subjects = { subjects: T.SUBJECTS.map(function (s) {
        return { id: s.id, name: s.name, nameNp: s.nameNp, group: s.group, marks: s.marks, banks: s.banks };
      }) };
    }
    state.weightage = await Store.getWeightage();
    state.counts = await Store.loadCounts();
    var idx = await Store.loadIndex();
    if (idx) Track.cacheIndex(idx);
    state.cfg = await Store.config();
    state.user = await waitForAuth();
    state.key = Store.identity();
    state.profile = Store.getProfile(state.key);
    state.manual = Store.getManual(state.key);
    state.events = buildEvents();
    state.total = compute();
    renderAll();
  }

  function buildEvents() {
    var mine = Track.mine();
    var legacy = Track.legacyEvents().filter(function (e) { return e && e.userKey === state.key; });
    var realKeys = {};
    mine.forEach(function (e) { if (e && e.questionKey) realKeys[e.questionKey] = true; });
    return mine.concat(legacy.filter(function (e) { return !realKeys[e.questionKey]; }))
      .filter(function (e) { return e && e.questionKey; });
  }

  function compute() {
    var W = state.weightage;
    var weightTotal = W.subjects.reduce(function (a, s) { return a + s.marks; }, 0);
    var minAttempts = Math.max(1, Number(state.profile.minAttempts) || 12);
    var rows = state.subjects.subjects.map(function (s) {
      var weight = W.subjects.find(function (w) { return w.id === s.id; }) || { marks: 0 };
      var evs = state.events.filter(function (e) { return e.subjectId === s.id; });
      var uniqueObj = {}, correct = 0;
      evs.forEach(function (e) {
        uniqueObj[e.questionKey] = true;
        if (e.correct) correct++;
      });
      var attempts = evs.length, unique = Object.keys(uniqueObj).length;
      var available = (state.counts && state.counts.subjects && state.counts.subjects[s.id]) || 0;
      var accuracy = attempts ? correct * 100 / attempts : 0;
      var coverage = available ? unique * 100 / available : 0;
      var weakness = attempts >= minAttempts ? (100 - accuracy) * 0.62 + (100 - coverage) * 0.38 : null;
      var priority = (weakness == null || !W.valid) ? null : weakness * (weight.marks / (weightTotal || 200));
      var lastBank = "";
      for (var i = evs.length - 1; i >= 0; i--) { if (evs[i].bankId) { lastBank = evs[i].bankId; break; } }
      var bank = lastBank || (s.banks && s.banks[0]) || "";
      return {
        id: s.id, name: s.name, nameNp: s.nameNp || "", group: s.group,
        marks: weight.marks, available: available, attempts: attempts,
        unique: unique, correct: correct, accuracy: accuracy, coverage: coverage,
        completion: coverage, weakness: weakness, priority: priority,
        bank: bank, focus: (state.profile.focus || []).indexOf(s.id) >= 0
      };
    });

    var uniqueAll = {}, correctAll = 0;
    state.events.forEach(function (e) { uniqueAll[e.questionKey] = true; if (e.correct) correctAll++; });
    var attemptsAll = state.events.length;
    var availableAll = rows.reduce(function (a, r) { return a + r.available; }, 0);
    var weighted = 0;
    if (W.valid && weightTotal === 200) {
      weighted = rows.reduce(function (a, r) { return a + (r.marks * r.completion / 100); }, 0) / weightTotal * 100;
    }
    var sorted = rows.filter(function (r) { return r.priority != null; }).sort(function (a, b) { return b.priority - a.priority; });
    var rank = {};
    sorted.forEach(function (r, i) { rank[r.id] = i + 1; });
    rows.forEach(function (r) { r.rank = rank[r.id] || null; });

    return {
      rows: rows,
      ranked: sorted,
      weightTotal: weightTotal,
      weighted: W.valid ? weighted : null,
      attempts: attemptsAll,
      unique: Object.keys(uniqueAll).length,
      correct: correctAll,
      available: availableAll,
      accuracy: attemptsAll ? correctAll * 100 / attemptsAll : 0,
      coverage: availableAll ? Object.keys(uniqueAll).length * 100 / availableAll : 0,
      minAttempts: minAttempts
    };
  }

  function activityDays() {
    var days = {};
    state.events.forEach(function (e) { var k = dayKey(e.attemptedAt); if (k) days[k] = true; });
    var daily = readStore("medarena.dailySolved.v1", {});
    Object.keys(daily || {}).forEach(function (k) { if (Number(daily[k]) > 0) days[k] = true; });
    var screen = readStore("medarena.screenTime.v1", {});
    Object.keys(screen || {}).forEach(function (k) { if (Number(screen[k]) > 0) days[k] = true; });
    var rev = readStore("medarena.revisions.v1", {});
    var log = (rev && rev.log) || {};
    Object.keys(log).forEach(function (k) { if (log[k] && Number(log[k].seen) > 0) days[k] = true; });
    return days;
  }
  function streak() {
    var days = activityDays();
    var today = dayKey(Date.now()), anchor = null;
    if (days[today]) anchor = today;
    else if (days[shiftDay(today, -1)]) anchor = shiftDay(today, -1);
    if (!anchor) return 0;
    var n = 0, cur = anchor;
    while (days[cur]) { n++; cur = shiftDay(cur, -1); }
    return n;
  }

  function renderAll() {
    renderIdentity();
    renderMetrics();
    renderWeightWarning();
    renderProfileForm();
    renderSubjects();
    renderWeakness();
    renderChapters();
    renderPlan();
    renderCharts();
    renderSource();
  }

  function renderIdentity() {
    var u = state.user;
    var name = state.profile.displayName || (u && (u.name || u.email)) || " learner";
    $("pbGreeting").textContent = "नमस्ते, " + name;
    $("pbIdentity").textContent = u
      ? ((u.email || u.sub || "Signed in") + " · " + (window.MACLOUD && window.MACLOUD.online ? "account sync active" : "local session"))
      : "This device only — sign in on the homepage to sync across devices";
    var pic = u && u.picture;
    $("pbAvatar").innerHTML = pic
      ? '<img src="' + esc(pic) + '" alt="" referrerpolicy="no-referrer">'
      : esc(String(name).trim().slice(0, 1).toUpperCase() || "प");
  }

  function renderMetrics() {
    var s = state.total;
    $("mWeighted").textContent = s.weighted == null ? "—" : pct(s.weighted);
    $("mWeightedNote").textContent = state.weightage.valid ? "Σ weight × completion ÷ 200" : "weightage total invalid";
    $("mAccuracy").textContent = s.attempts ? pct(s.accuracy) : "—";
    $("mAccuracyNote").textContent = fmt(s.correct) + " correct / " + fmt(s.attempts) + " attempted";
    $("mCoverage").textContent = s.available ? pct(s.coverage) : "—";
    $("mCoverageNote").textContent = fmt(s.unique) + " unique / " + fmt(s.available) + " available";
    $("mStreak").textContent = streak() || "—";
    $("mStreakNote").textContent = "study days in a row";
    $("mAttempts").textContent = fmt(s.attempts);
    $("mUniqueNote").textContent = fmt(s.unique) + " unique questions";
  }

  function renderWeightWarning() {
    var box = $("weightWarn"), W = state.weightage;
    if (W.valid && W.total === 200) { box.hidden = true; $("configSource").textContent = "weightage: " + W.source + " · 200/200"; return; }
    box.hidden = false;
    box.innerHTML = "⚠ Configured weightage totals <b>" + W.total + "</b> marks, not 200. Weighted progress, shares and priority are paused until an admin corrects it in the admin panel. Raw attempts, accuracy and unique coverage are still shown.";
    $("configSource").textContent = "weightage invalid · " + W.total + "/200";
  }

  function renderProfileForm() {
    var p = state.profile;
    $("pfName").value = p.displayName || (state.user && (state.user.name || state.user.email)) || "";
    $("pfTarget").value = Number(p.targetMarks) || 200;
    $("pfExamDate").value = p.examDate || "";
    $("pfDaily").value = Number(p.dailyMinutes) || 30;
    $("pfMinAttempts").value = Number(p.minAttempts) || 12;
    $("pfWeak").innerHTML = state.subjects.subjects.map(function (s) {
      var on = (p.focus || []).indexOf(s.id) >= 0;
      return '<label><input type="checkbox" data-focus="' + esc(s.id) + '"' + (on ? " checked" : "") + '>' + esc(s.name) + "</label>";
    }).join("");
    $("pfMeta").textContent = p.updatedAt ? "Last saved " + new Date(p.updatedAt).toLocaleString() : "Not saved yet — defaults are not shared.";
  }

  function renderSubjects() {
    if (!state.weightage.valid) {
      $("subjectBody").innerHTML = '<tr><td colspan="9"><div class="pb-empty">Fix the 200-mark weightage total to enable weighted progress and priority.</div></td></tr>';
      return;
    }
    var host = $("subjectBody");
    if (!host) return;
    var maxMark = Math.max.apply(null, state.total.rows.map(function (r) { return r.marks; })) || 18;
    host.innerHTML = state.total.rows.map(function (r) {
      var status = r.priority == null
        ? '<span class="pb-pill mute">Need ' + Math.max(0, state.total.minAttempts - r.attempts) + " more</span>"
        : '<span class="pb-pill ' + (r.rank <= 3 ? "bad" : r.rank <= 7 ? "warn" : "ok") + '">#' + r.rank + " priority</span>";
      var url = T.practiceUrl(r.bank, "");
      return "<tr>" +
        '<td class="pb-subj">' + esc(r.name) + "<small>" + esc(r.nameNp || r.group) + "</small></td>" +
        '<td class="num"><b>' + r.marks + "</b><br><span class='pb-hint'>" + (r.marks / 2).toFixed(1) + "%</span></td>" +
        "<td class='num'>" + fmt(r.available) + "</td>" +
        "<td class='num'>" + fmt(r.unique) + "</td>" +
        '<td><div style="display:flex;align-items:center;gap:7px"><div class="pb-bar" style="flex:1"><i style="width:' + Math.min(100, r.coverage) + '%"></i></div><span class="pb-hint">' + pct(r.coverage) + "</span></div></td>" +
        '<td><div style="display:flex;align-items:center;gap:7px"><div class="pb-bar acc" style="flex:1"><i style="width:' + Math.min(100, r.accuracy) + '%"></i></div><span class="pb-hint">' + (r.attempts ? pct(r.accuracy) : "—") + "</span></div></td>" +
        "<td class='num'>" + fmt(r.attempts) + "</td>" +
        "<td>" + status + "</td>" +
        '<td><a class="pb-btn pb-btn-soft pb-btn-sm" href="' + esc(url) + '">Practice →</a></td>' +
        "</tr>";
    }).join("");
  }

  function renderWeakness() {
    var rows = state.total.ranked.slice(0, 12);
    if (!rows.length) {
      var collecting = state.total.rows.slice().sort(function (a, b) { return b.attempts - a.attempts; }).slice(0, 8);
      $("weakBody").innerHTML = collecting.map(function (r) {
        return "<tr><td class='pb-subj'>" + esc(r.name) + "</td><td class='num'>" + fmt(r.attempts) + "</td><td class='num'>" + (r.attempts ? pct(r.accuracy) : "—") + "</td><td class='num'>" + pct(r.coverage) + "</td><td class='num'>—</td><td><span class='pb-pill mute'>Need " + Math.max(0, state.total.minAttempts - r.attempts) + " more</span></td></tr>";
      }).join("") || '<tr><td colspan="6"><div class="pb-empty">No attempts recorded yet. Finish a practice block to start your analysis.</div></td></tr>';
      return;
    }
    $("weakBody").innerHTML = rows.map(function (r) {
      return "<tr><td class='pb-subj'>" + esc(r.name) + "</td><td class='num'>" + fmt(r.attempts) + "</td><td class='num'>" + pct(r.accuracy) + "</td><td class='num'>" + pct(r.coverage) + "</td><td class='num'><b>" + r.priority.toFixed(1) + "</b></td><td><span class='pb-pill " + (r.rank <= 3 ? "bad" : "warn") + "'>#" + r.rank + " focus</span></td></tr>";
    }).join("");
  }

  function renderChapters() {
    var sel = $("chapterSubject");
    var ids = state.subjects.subjects.map(function (s) { return s.id; });
    if (!sel.dataset.ready) {
      sel.innerHTML = ids.map(function (id) {
        var s = state.subjects.subjects.find(function (x) { return x.id === id; });
        return '<option value="' + esc(id) + '">' + esc(s.name) + "</option>";
      }).join("");
      sel.dataset.ready = "1";
      var preferred = state.total.ranked[0] && state.total.ranked[0].id;
      if (preferred) sel.value = preferred;
    }
    var sid = sel.value || ids[0];
    var query = ($("chapterSearch").value || "").trim().toLowerCase();
    var chapters = (state.counts && state.counts.chapters && state.counts.chapters[sid]) || [];
    var evs = state.events.filter(function (e) { return e.subjectId === sid; });
    var html = "";
    var shown = 0;
    chapters.forEach(function (c) {
      if (query && c.name.toLowerCase().indexOf(query) < 0) return;
      if (shown >= 120) return;
      shown++;
      var cev = evs.filter(function (e) { return e.chapter === c.name; });
      var keys = {}, correct = 0;
      cev.forEach(function (e) { keys[e.questionKey] = true; if (e.correct) correct++; });
      var unique = Object.keys(keys).length;
      var coverage = c.available ? unique * 100 / c.available : 0;
      var accuracy = cev.length ? correct * 100 / cev.length : 0;
      var done = !!state.manual[sid + "||" + c.name];
      var bank = (c.banks && c.banks[0]) || "";
      html += "<tr>" +
        '<td><input type="checkbox" data-manual-subject="' + esc(sid) + '" data-manual-chapter="' + esc(c.name) + '"' + (done ? " checked" : "") + ' title="Mark chapter complete"></td>' +
        "<td><b>" + esc(c.name) + "</b></td>" +
        "<td class='num'>" + fmt(c.available) + "</td>" +
        "<td class='num'>" + fmt(unique) + "</td>" +
        '<td><div class="pb-bar" style="width:90px"><i style="width:' + Math.min(100, coverage) + '%"></i></div></td>' +
        '<td><span class="pb-pill ' + (!cev.length ? "mute" : accuracy >= 70 ? "ok" : accuracy >= 45 ? "warn" : "bad") + '">' + (cev.length ? pct(accuracy) : "—") + "</span></td>" +
        '<td><a class="pb-btn pb-btn-soft pb-btn-sm" href="' + esc(T.practiceUrl(bank, c.name)) + '">Practice →</a></td>' +
        "</tr>";
    });
    $("chapterBody").innerHTML = html || '<tr><td colspan="7"><div class="pb-empty">No chapters match this filter.</div></td></tr>';
  }

  function weakestChapter(row) {
    var evs = state.events.filter(function (e) { return e.subjectId === row.id; });
    var groups = {};
    evs.forEach(function (e) {
      var g = groups[e.chapter] || (groups[e.chapter] = { attempts: 0, correct: 0, keys: {}, bank: e.bankId });
      g.attempts++; if (e.correct) g.correct++; g.keys[e.questionKey] = true;
    });
    var best = null;
    Object.keys(groups).forEach(function (name) {
      var g = groups[name];
      var acc = g.attempts ? g.correct * 100 / g.attempts : 0;
      var score = (100 - acc) * Math.sqrt(g.attempts);
      if (!best || score > best.score) best = { name: name, attempts: g.attempts, accuracy: acc, bank: g.bank, score: score };
    });
    return best;
  }

  function renderPlan() {
    var W = state.weightage;
    if (!W.valid) {
      $("planBody").innerHTML = '<div class="pb-empty">Fix the weightage total first — the plan needs a valid 200-mark blueprint.</div>';
      return;
    }
    var minutes = Math.max(5, Number(state.profile.dailyMinutes) || 30);
    var ranked = state.total.ranked.slice();
    var focus = state.profile.focus || [];
    ranked.sort(function (a, b) {
      var af = focus.indexOf(a.id) >= 0 ? 1 : 0, bf = focus.indexOf(b.id) >= 0 ? 1 : 0;
      return (bf - af) || (b.priority - a.priority);
    });
    if (!ranked.length) {
      ranked = state.subjects.subjects.slice().sort(function (a, b) {
        return (b.marks || W.subjects.find(function (w) { return w.id === b.id; }).marks) - (a.marks || W.subjects.find(function (w) { return w.id === a.id; }).marks);
      }).slice(0, 3).map(function (s) {
        var row = state.total.rows.find(function (r) { return r.id === s.id; });
        return row;
      });
    }
    var top = ranked.slice(0, 3);
    if (!top.length) { $("planBody").innerHTML = '<div class="pb-empty">No plan available yet.</div>'; return; }
    var sum = top.reduce(function (a, r) { return a + (r.priority || r.marks); }, 0) || top.reduce(function (a, r) { return a + r.marks; }, 0);
    $("planBody").innerHTML = top.map(function (r, i) {
      var mins = Math.max(5, Math.round(minutes * ((r.priority || r.marks) / sum)));
      var qCount = Math.max(5, Math.round(mins * 0.7));
      var chap = weakestChapter(r);
      var bank = (chap && chap.bank) || r.bank;
      var url = T.practiceUrl(bank, chap ? chap.name : "");
      var wrong = state.events.filter(function (e) { return e.subjectId === r.id && !e.correct; }).length;
      return '<div class="pb-plan-item"><div class="pb-plan-rank">' + (i + 1) + "</div><div>" +
        "<b>" + esc(r.name) + " · " + mins + " min</b>" +
        "<p>Practise about " + qCount + " questions" + (chap ? " in “" + esc(chap.name) + "”" : "") + " · " +
        (wrong ? "review " + fmt(wrong) + " wrong answer" + (wrong === 1 ? "" : "s") : "start with a diagnostic block") + "</p>" +
        '</div><a class="pb-btn pb-btn-primary pb-btn-sm" href="' + esc(url) + '">Practice →</a></div>';
    }).join("");
  }

  function renderCharts() {
    var today = dayKey(Date.now());
    var daily = readStore("medarena.dailySolved.v1", {});
    var days = [];
    for (var i = 13; i >= 0; i--) days.push(shiftDay(today, -i));
    var counts = days.map(function (d) { return { day: d, attempts: 0, correct: 0 }; });
    var map = {}; counts.forEach(function (c) { map[c.day] = c; });
    state.events.forEach(function (e) {
      var k = dayKey(e.attemptedAt), c = map[k];
      if (!c) return; c.attempts++; if (e.correct) c.correct++;
    });
    counts.forEach(function (c) {
      var legacy = Number((daily || {})[c.day]) || 0;
      if (legacy > c.attempts) c.attempts = legacy;
    });
    var max = Math.max.apply(null, counts.map(function (c) { return c.attempts; })) || 1;
    $("chartDays").innerHTML = counts.map(function (c) {
      var h = Math.max(2, Math.round(c.attempts / max * 100));
      var correctH = c.attempts ? Math.max(1, Math.round(c.correct / max * 100)) : 0;
      return '<div class="pb-col" title="' + c.day + ': ' + c.attempts + ' attempts, ' + c.correct + ' correct">' +
        (c.attempts ? "<b>" + c.attempts + "</b>" : "") +
        '<div style="width:20px;height:' + h + '%;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#60a5fa,#2563eb);position:relative">' +
          (c.correct ? '<div style="position:absolute;left:0;right:0;bottom:0;height:' + correctH + '%;background:#059669;border-radius:0 0 0 0"></div>' : "") +
        "</div>" +
        "<span>" + c.day.slice(8) + "</span></div>";
    }).join("");

    var rows = state.total.rows.slice().sort(function (a, b) { return b.marks - a.marks; });
    var maxCov = Math.max.apply(null, rows.map(function (r) { return r.coverage; })) || 100;
    $("chartSubjects").innerHTML = rows.map(function (r) {
      var wh = Math.max(2, Math.round(r.marks / 18 * 100));
      var ch = Math.max(1, Math.round(r.coverage / maxCov * 100));
      return '<div class="pb-col" style="flex-direction:row;align-items:flex-end;gap:3px" title="' + esc(r.name) + ': ' + r.marks + ' marks, ' + pct(r.coverage) + ' coverage">' +
        '<i style="height:' + wh + '%;width:38%;max-width:11px"></i>' +
        '<i style="height:' + ch + '%;width:38%;max-width:11px;background:#059669"></i>' +
        "<span style=\"position:absolute;bottom:-20px;transform:rotate(-45deg);transform-origin:left top;font-size:8px\">" + esc(r.name.slice(0, 9)) + "</span></div>";
    }).join("");
  }

  function renderSource() {
    var cfg = state.cfg || {};
    var legacy = state.events.filter(function (e) { return e.source === "medarena.solved"; }).length;
    var live = state.events.length - legacy;
    var supa = cfg.enabled && cfg.url && cfg.anonKey;
    $("sourceBody").innerHTML =
      "Identity: <b>" + (state.user ? esc(state.user.email || state.user.sub || "Signed in") : "This device") + "</b><br>" +
      "Live answer events: <b>" + fmt(live) + "</b> · backfilled solved questions: <b>" + fmt(legacy) + "</b><br>" +
      "Question catalogue: <b>" + fmt(state.counts ? state.counts.totalQuestions : 0) + "</b> questions · " +
      (state.counts && state.counts.generatedAt ? "generated " + esc(new Date(state.counts.generatedAt).toLocaleDateString()) : "not loaded") + "<br>" +
      "Weightage source: <b>" + esc(state.weightage.source) + "</b> · total " + state.weightage.total + "/200<br>" +
      "Supabase: <b>" + (supa ? "configured (RLS enforced)" : "not configured") + "</b><br>" +
      "<span class='pb-hint'>" + (supa
        ? "Rows are sent only when a valid user JWT is present. The anon key alone cannot write past RLS."
        : "No project URL/key is set, so analytics stay in this browser and use the existing Worker endpoints when available.") + "</span>";
  }

  function bind() {
    $("pfSave").addEventListener("click", async function () {
      var focus = [].slice.call(document.querySelectorAll("[data-focus]")).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.focus; });
      var target = Math.min(200, Math.max(1, Number($("pfTarget").value) || 200));
      var daily = Math.min(480, Math.max(5, Number($("pfDaily").value) || 30));
      var minAttempts = Math.min(500, Math.max(1, Number($("pfMinAttempts").value) || 12));
      state.profile = await Store.saveProfile(state.key, {
        displayName: $("pfName").value.trim(),
        targetMarks: target,
        examDate: $("pfExamDate").value,
        dailyMinutes: daily,
        minAttempts: minAttempts,
        focus: focus
      });
      state.total = compute();
      renderIdentity(); renderProfileForm(); renderMetrics(); renderSubjects(); renderPlan(); renderSource();
      toast("Goals saved for " + (state.profile.displayName || "your account") + ".");
    });

    $("chapterBody").addEventListener("change", function (e) {
      var el = e.target;
      if (!el || !el.dataset || !el.dataset.manualSubject) return;
      var sid = el.dataset.manualSubject, chapter = el.dataset.manualChapter;
      state.manual = Store.setManual(state.key, sid, chapter, el.checked);
      toast(el.checked ? "Chapter marked complete." : "Chapter completion removed.");
    });
    $("chapterSubject").addEventListener("change", renderChapters);
    $("chapterSearch").addEventListener("input", renderChapters);

    var projecting = false;
    $("projectorBtn").addEventListener("click", function () {
      projecting = !projecting;
      document.body.classList.toggle("pb-projecting", projecting);
      $("projectorBtn").setAttribute("aria-pressed", String(projecting));
      $("projectorBtn").textContent = projecting ? "↩ Exit projector" : "⛶ Projector mode";
      if (projecting && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
      else if (!projecting && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    });
    document.addEventListener("fullscreenchange", function () {
      if (!document.fullscreenElement && projecting) $("projectorBtn").click();
    });
  }

  bind();
  load().catch(function (e) {
    console.error("Pragati Bibaran load failed", e);
    $("sourceBody").innerHTML = "Could not load analytics data: " + esc(e && e.message ? e.message : e);
  });
})();
