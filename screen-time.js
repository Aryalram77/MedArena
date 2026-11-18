/* MedArena screen-time tracker.
   Counts only time the tab is actually visible. Stores per-day seconds locally
   in localStorage — no account, no network, no admin data. */
(function () {
  "use strict";
  if (window.__medarenaScreenTime) return;

  var KEY = "medarena.screenTime.v1";
  var FLUSH_MS = 2000;   // write to storage every ~2s
  var MAX_TICK = 60000;  // ignore huge jumps (laptop sleep / clock change)

  var store = {};
  try {
    var raw = localStorage.getItem(KEY);
    var parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") store = parsed;
  } catch (e) {}

  function pad(n) { return String(n).padStart(2, "0"); }
  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  var today = dayKey(Date.now());
  Object.keys(store).forEach(function (k) { if (k > today) delete store[k]; });

  var pending = 0;
  var last = Date.now();
  var active = !document.hidden;

  function save() {
    if (pending < 1000) return;
    var sec = Math.floor(pending / 1000);
    pending -= sec * 1000;
    /* Re-read so two open tabs do not overwrite each other's totals. */
    try {
      var cur = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (cur && typeof cur === "object") store = cur;
    } catch (e) {}
    var k = dayKey(Date.now());
    today = k;
    store[k] = (Number(store[k]) || 0) + sec;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent("medarena:screentime", {
        detail: { key: k, seconds: store[k] }
      }));
    } catch (e) {}
  }

  function tick() {
    var now = Date.now();
    var delta = now - last;
    last = now;
    if (delta < 0 || delta > MAX_TICK) delta = 0;
    if (active && document.visibilityState === "visible" && !document.hidden) pending += delta;
    if (pending >= FLUSH_MS) save();
  }

  setInterval(tick, 1000);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { tick(); active = false; save(); }
    else { active = true; last = Date.now(); today = dayKey(Date.now()); }
  });
  window.addEventListener("pagehide", function () { tick(); save(); });
  window.addEventListener("beforeunload", function () { tick(); save(); });

  /* Small read-only API for on-page dashboards. */
  window.__medarenaScreenTime = {
    key: dayKey,
    data: function () {
      var out = {};
      Object.keys(store).forEach(function (k) { out[k] = Number(store[k]) || 0; });
      return out;
    },
    pending: function () { return pending; },
    today: function () {
      var k = dayKey(Date.now());
      return (Number(store[k]) || 0) + (active ? Math.floor(pending / 1000) : 0);
    }
  };
})();
