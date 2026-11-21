/* UI wiring for the Chapter Cards scaffold. Reads data.js + validator.js. */
(function () {
  "use strict";

  const chapters = window.CHAPTERS || [];
  const V = window.CardValidator;
  const STORE_KEY = "chapter-cards:known:v1";
  const HL_KEY = "chapter-cards:highlights:v1";
  const PROGRESS_KEY = "chapter-cards:progress:v1";
  const SUBJECT_KEY = "chapter-cards:subjects:v1";

  const state = {
    chapterId: chapters.length ? chapters[0].id : null,
    view: "cards",
    typeFilter: "all",
    search: "",
    modalCardId: null,
    modalRevealed: true,
    known: loadKnown(),
    highlights: loadHighlights(),
    progress: loadProgress(),
    expandedSubjects: loadSubjects()
  };
  let pendingRange = null;
  let pendingAnswerScroll = null;
  let resumeScrolledFor = null;

  const el = {};
  ["chapterList", "chapterEyebrow", "chapterTitle", "chapterMeta", "coveragePct",
    "coverageBar", "coverageSub", "cardCount", "issueCount", "typeFilters",
    "resumeBar", "resumeTitle", "resumeDetail", "resumeOpen", "resumeDismiss",
    "search", "cardGrid", "emptyCards", "coverageReport", "outlineTree", "toast",
    "cardModal", "modalType", "modalTopics", "modalCounter", "modalClose",
    "modalQuestion", "modalAnswerWrap", "modalAnswer", "modalBody", "modalPage",
    "modalReveal", "modalReview", "modalKnown", "hlClear", "modalLink"
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  function loadKnown() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveKnown() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.known)); } catch (e) {}
  }
  function loadHighlights() {
    try { return JSON.parse(localStorage.getItem(HL_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveHighlights() {
    try { localStorage.setItem(HL_KEY, JSON.stringify(state.highlights)); } catch (e) {}
  }
  function loadSubjects() {
    try {
      const s = JSON.parse(localStorage.getItem(SUBJECT_KEY) || "{}");
      return s && typeof s === "object" ? s : {};
    } catch (e) { return {}; }
  }
  function saveSubjects() {
    try { localStorage.setItem(SUBJECT_KEY, JSON.stringify(state.expandedSubjects)); } catch (e) {}
  }

  /* ---------- Resume: remember where study stopped, per chapter ---------- */
  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
      return p && typeof p === "object" ? p : {};
    } catch (e) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress)); } catch (e) {}
  }
  function chapterPoint(id) {
    if (!state.progress.chapters || typeof state.progress.chapters !== "object") {
      state.progress.chapters = {};
    }
    const point = state.progress.chapters[id];
    if (!point || typeof point !== "object") state.progress.chapters[id] = {};
    return state.progress.chapters[id];
  }
  function capturePoint() {
    const chapter = currentChapter();
    if (!chapter) return;
    const point = chapterPoint(chapter.id);
    point.typeFilter = state.typeFilter;
    point.search = state.search;
    point.revealed = state.modalRevealed;
    // A closed modal must not erase the last card the reader was on.
    if (state.modalCardId) point.cardId = state.modalCardId;
    // Only a visible answer has a meaningful scroll position; hiding must not
    // overwrite the position the reader had reached.
    if (modalOpen() && !el.modalAnswerWrap.classList.contains("hidden")) {
      point.scrollTop = el.modalBody.scrollTop;
    }
    point.at = Date.now();
    state.progress.activeChapterId = chapter.id;
    saveProgress();
  }
  function restoreChapterUi() {
    const all = state.progress.chapters || {};
    const point = all[state.chapterId] || {};
    state.typeFilter = point.typeFilter || "all";
    state.search = typeof point.search === "string" ? point.search : "";
    state.modalRevealed = point.revealed !== false;
    el.search.value = state.search;
  }
  function resumeTargetInfo() {
    const chapter = currentChapter();
    if (!chapter) return null;
    const all = state.progress.chapters || {};
    const point = all[chapter.id];
    if (!point || !point.cardId) return null;
    const list = visibleCards(chapter);
    const index = list.map(function (c) { return c.id; }).indexOf(point.cardId);
    if (index < 0) return null; // filter changed since - nothing to resume to
    return { card: list[index], index: index, total: list.length, point: point };
  }
  function renderResumeBar() {
    const info = resumeTargetInfo();
    if (!info) { el.resumeBar.classList.add("hidden"); return; }
    const question = String(info.card.front || "").replace(/\s+/g, " ").trim();
    el.resumeDetail.textContent = "Card " + (info.index + 1) + " of " + info.total + " · " +
      (question.length > 110 ? question.slice(0, 107) + "…" : question);
    el.resumeBar.classList.remove("hidden");

    const cards = Array.prototype.slice.call(el.cardGrid.querySelectorAll(".card"));
    cards.forEach(function (n) { n.classList.remove("resume-target"); });
    const target = cards.filter(function (n) { return n.dataset.id === info.card.id; })[0];
    if (target) {
      target.classList.add("resume-target");
      const token = state.chapterId + ":" + info.card.id + ":" + state.typeFilter + ":" + state.search;
      if (resumeScrolledFor !== token) {
        resumeScrolledFor = token;
        target.scrollIntoView({ block: "center" });
      }
    }
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* Automatic high-yield colouring + the reader's own 3-colour highlights.
     Both become character ranges over the original text and are merged in one
     pass, so nested marks never corrupt or duplicate the underlying words. */
  const HL_PATTERNS = [
    // Text that carried a superscript "Q" in the source PDF (amber + bold).
    // First so it wins over the automatic patterns when spans overlap.
    { cls: "hl-q", inner: true, re: /==([^=]+)==/g },
    { cls: "hl-star", inner: true, re: /\*\*([^*]+)\*\*/g },
    { cls: "hl-warn", re: /\b(not|never|must|only|avoid|contraindicated|prohibited|fatal|dangerous|do not)\b/gi },
    { cls: "hl-key", re: /\b(most common|least common|most malignant|best prognosis|worst prognosis|drug of choice|gold standard|first-line|first line|most frequently|most important|IOC|MC)\b/gi },
    { cls: "hl-term", re: /\b(BIRADS|DCIS|LCIS|ER|PR|HER2|HER-2|MRI|FNAC|NPI|VNPI|TRAM|DIEP|TNM|BRCA1|BRCA2|NST|ANDI|TNBC|SERMs?)\b/g }
  ];

  function autoRanges(raw) {
    const out = [];
    HL_PATTERNS.forEach(function (p) {
      let m;
      p.re.lastIndex = 0;
      while ((m = p.re.exec(raw)) !== null) {
        const s = m.index, e = m.index + m[0].length;
        if (e > s && !out.some(function (r) { return s < r.end && e > r.start; })) {
          out.push({ start: s, end: e, cls: p.cls, inner: !!p.inner });
        }
      }
    });
    return out.sort(function (a, b) { return a.start - b.start; });
  }

  function renderText(text, key) {
    const raw = String(text == null ? "" : text);
    const auto = autoRanges(raw);

    /* Build the text the reader actually sees. Marker syntax (==...== and
       **...**) is stripped here, and every automatic highlight is remapped
       onto that cleaned text, so stored user highlights stay consistent. */
    let clean = "";
    const marks = [];
    let cursor = 0;
    auto.forEach(function (r) {
      if (r.start < cursor) return;
      clean += raw.slice(cursor, r.start);
      const start = clean.length;
      clean += r.inner ? raw.slice(r.start + 2, r.end - 2) : raw.slice(r.start, r.end);
      marks.push({ start: start, end: clean.length, cls: r.cls });
      cursor = r.end;
    });
    clean += raw.slice(cursor);

    const mine = (state.highlights[key] || []).filter(function (r) {
      return r && typeof r.start === "number" && typeof r.end === "number" &&
        r.start >= 0 && r.end <= clean.length && r.end > r.start;
    });
    const user = mine.map(function (r) {
      return { start: r.start, end: r.end, cls: "user-hl user-hl-" + r.color, original: r };
    });

    const pts = [0, clean.length];
    marks.concat(user).forEach(function (r) { pts.push(r.start, r.end); });
    const bounds = Array.from(new Set(pts)).sort(function (a, b) { return a - b; });

    let html = "";
    for (let i = 0; i < bounds.length - 1; i++) {
      const a = bounds[i], b = bounds[i + 1];
      if (b <= a) continue;
      const ar = marks.filter(function (r) { return r.start <= a && r.end >= b; })[0];
      const ur = user.filter(function (r) { return r.start <= a && r.end >= b; })[0];
      let seg = escapeHtml(clean.slice(a, b));
      if (ar) seg = '<mark class="' + ar.cls + '">' + seg + '</mark>';
      if (ur) seg = '<mark class="' + ur.cls + '" data-hs="' + ur.original.start + '" data-he="' + ur.original.end + '">' + seg + '</mark>';
      html += seg;
    }
    return html;
  }
  // Optional cropped figures attached to a card. Paths are relative to index.html.
  function renderImages(card) {
    const imgs = card.images || [];
    if (!imgs.length) return "";
    return '<div class="card-figures">' + imgs.map(function (src) {
      return '<figure class="card-figure">' +
        '<img src="' + escapeHtml(src) + '" alt="Anatomical figure · PDF p.' + escapeHtml(card.sourcePage || "?") + '" loading="lazy" />' +
        '<figcaption>Fig · PDF p.' + escapeHtml(card.sourcePage || "?") + '</figcaption>' +
        '</figure>';
    }).join("") + '</div>';
  }

  function currentChapter() {
    return chapters.find(function (c) { return c.id === state.chapterId; }) || chapters[0];
  }
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.remove("show"); }, 1800);
  }

  /* ---------- Sidebar + header ---------- */
  // Every chapter belongs to a subject. Chapters that do not declare one
  // default to "Surgery", so chapters added from later PDFs join the same
  // single group automatically unless they explicitly opt into another subject.
  var DEFAULT_SUBJECT = "Surgery";
  function subjectOf(chapter) {
    return (chapter && chapter.subject) || DEFAULT_SUBJECT;
  }

  function renderSidebar() {
    const saved = (state.progress.chapters || {});
    // Group by subject, preserving first-seen order.
    const groups = [];
    const bySubject = Object.create(null);
    chapters.forEach(function (c) {
      const subject = subjectOf(c);
      if (!bySubject[subject]) { bySubject[subject] = []; groups.push(subject); }
      bySubject[subject].push(c);
    });
    Object.keys(bySubject).forEach(function (s) {
      bySubject[s].sort(function (a, b) { return (a.number || 0) - (b.number || 0); });
    });

    el.chapterList.innerHTML = groups.map(function (subject) {
      const items = bySubject[subject].map(function (c) {
        const r = V.validateChapter(c);
        const point = saved[c.id];
        const hasResume = !!(point && point.cardId && (c.cards || []).some(function (card) { return card.id === point.cardId; }));
        return '<button class="chapter-btn ' + (c.id === state.chapterId ? "active" : "") + '" data-chapter="' + escapeHtml(c.id) + '">' +
          '<span class="chapter-num">' + escapeHtml(c.number || "•") + '</span>' +
          '<span class="chapter-name">' + escapeHtml(c.title) + '</span>' +
          (hasResume ? '<span class="chapter-resume" title="Resume point saved">↺</span>' : '') +
          '<span class="chapter-pct ' + (r.passed ? "done" : "") + '">' + r.coveragePct + '%</span>' +
          '</button>';
      }).join("");
      const expanded = state.expandedSubjects[subject] === true;
      return '<section class="subject-group' + (expanded ? '' : ' collapsed') + '" data-subject-group="' + escapeHtml(subject) + '">' +
        '<button type="button" class="subject-heading" data-subject="' + escapeHtml(subject) + '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
          '<span class="subject-caret" aria-hidden="true">' + (expanded ? '▾' : '▸') + '</span>' +
          '<span class="subject-name">' + escapeHtml(subject) + '</span>' +
          '<span class="subject-count">' + bySubject[subject].length + '</span>' +
        '</button>' +
        '<div class="subject-chapters">' + items + '</div>' +
        '</section>';
    }).join("");
  }

  function renderHeader(chapter, report) {
    el.chapterEyebrow.textContent = "CHAPTER " + (chapter.number || "—") + " · " + (chapter.source && chapter.source.file ? chapter.source.file : "SOURCE NOT SET");
    el.chapterTitle.textContent = chapter.title;
    const cards = chapter.cards || [];
    const types = Array.from(new Set(cards.map(function (c) { return c.type; })));
    el.chapterMeta.innerHTML =
      '<span>' + cards.length + ' cards</span>' +
      '<span>' + report.totalLeaves + ' outline topics</span>' +
      '<span>' + types.length + ' card types</span>' +
      '<span>' + escapeHtml((chapter.source && chapter.source.pageRange) || "pages ?") + '</span>' +
      '<span>status: ' + escapeHtml(chapter.status || "draft") + '</span>';

    el.coveragePct.textContent = report.coveragePct + "%";
    el.coverageBar.style.width = report.coveragePct + "%";
    el.coverageSub.textContent = report.coveredLeaves + " / " + report.totalLeaves + " topics covered";
    el.cardCount.textContent = cards.length;
    el.issueCount.textContent = report.errorCount + report.warnCount;
    el.issueCount.className = "pill " + (report.errorCount ? "bad" : report.warnCount ? "" : "good");
  }

  /* ---------- Cards ---------- */
  function visibleCards(chapter) {
    const q = state.search.trim().toLowerCase();
    const index = V.nodeIndex(chapter.outline);
    return (chapter.cards || []).filter(function (card) {
      if (state.typeFilter !== "all" && card.type !== state.typeFilter) return false;
      if (!q) return true;
      const topicText = (card.topics || []).map(function (id) {
        return index[id] ? index[id].node.title : id;
      }).join(" ");
      return (card.front + " " + card.back + " " + topicText + " " + (card.type || "")).toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderFilters(chapter) {
    const types = Array.from(new Set((chapter.cards || []).map(function (c) { return c.type; })));
    if (state.typeFilter !== "all" && types.indexOf(state.typeFilter) === -1) state.typeFilter = "all";
    el.typeFilters.innerHTML = ["all"].concat(types).map(function (t) {
      return '<button class="chip ' + (state.typeFilter === t ? "active" : "") + '" data-type="' + escapeHtml(t) + '">' +
        (t === "all" ? "All" : escapeHtml(t)) + '</button>';
    }).join("");
  }

  function renderCards(chapter) {
    const index = V.nodeIndex(chapter.outline);
    const cards = visibleCards(chapter);
    el.emptyCards.classList.toggle("hidden", cards.length > 0);
    el.cardGrid.innerHTML = cards.map(function (card) {
      const topics = (card.topics || []).map(function (id) {
        return index[id] ? index[id].node.title : id;
      });
      const key = chapter.id + ":" + card.id;
      const known = state.known[key];
      return '<article class="card" data-id="' + escapeHtml(card.id) + '" tabindex="0">' +
        '<div class="card-inner" data-open="' + escapeHtml(card.id) + '">' +
          '<div class="card-rotor">' +
            '<div class="card-face card-front">' +
              '<div class="face-top"><span class="type-tag t-' + escapeHtml(card.type) + '">' + escapeHtml(card.type) + '</span>' +
                topics.map(function (t) { return '<span class="topic-tag">' + escapeHtml(t) + '</span>'; }).join("") + '</div>' +
              '<p class="card-q">' + renderText(card.front, key) + '</p>' +
              '<p class="flip-hint" style="position:absolute;bottom:10px">Click to open big card ⤢</p>' +
            '</div>' +
            '<div class="card-face card-back">' +
              '<div class="back-label">ANSWER · ' + escapeHtml(card.type.toUpperCase()) + '</div>' +
              '<p class="card-a">' + renderText(card.back, key) + '</p>' + renderImages(card) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-foot">' +
          '<span class="card-page">' + (card.sourcePage ? "PDF p." + escapeHtml(card.sourcePage) : "—") + '</span>' +
          '<div class="card-actions">' +
            '<button class="mini-btn review ' + (known === "review" ? "active" : "") + '" data-act="review" data-key="' + escapeHtml(key) + '">Review</button>' +
            '<button class="mini-btn known ' + (known === "known" ? "active" : "") + '" data-act="known" data-key="' + escapeHtml(key) + '">Got it</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join("");
  }

  /* ---------- Coverage + outline ---------- */
  function treeNodeHtml(entry, report) {
    const node = entry.node;
    const stat = report.stats[node.id] || { count: 0, types: [] };
    const leaf = !node.children || !node.children.length;
    let cls = "ok", label = stat.count + " card" + (stat.count === 1 ? "" : "s");
    if (!entry.covered) { cls = "bad"; label = "MISSING"; }
    else if (leaf && stat.count === 1 && stat.types.length === 1 && ["fact", "definition"].indexOf(stat.types[0]) !== -1) {
      cls = "thin"; label = "thin";
    } else if (!leaf && entry.own === 0) { label = stat.count + " in children"; }
    let html = '<div class="tree-node" style="--depth:' + entry.depth + '">' +
      '<div class="tree-row">' +
        '<span class="tree-id">' + escapeHtml(node.id) + '</span>' +
        '<span class="tree-title">' + escapeHtml(node.title) + '</span>' +
        (node.page ? '<span class="tree-page">p.' + escapeHtml(node.page) + '</span>' : '') +
        '<span class="tree-status ' + cls + '">' + label + '</span>' +
      '</div>';
    if (stat.types.length) {
      html += '<div class="tree-types">types: ' + stat.types.map(escapeHtml).join(", ") + '</div>';
    }
    html += entry.children.map(function (c) { return treeNodeHtml(c, report); }).join("");
    return html + '</div>';
  }

  function renderCoverage(chapter, report) {
    const good = report.passed;
    let html = '<div class="verdict ' + (good ? "good" : "bad") + '">' +
      '<div class="icon">' + (good ? "✓" : "!") + '</div><div>' +
      '<strong>' + (good ? "Chapter complete — no topic left out" : "Chapter incomplete — " + report.missing.length + " topic(s) have no card") + '</strong>' +
      '<span>' + (good
        ? "All " + report.totalLeaves + " outline topics are covered and the structure is valid. " + (report.warnCount ? report.warnCount + " improvement warning(s) below." : "No warnings.")
        : "Add at least one card for every topic marked MISSING, then re-open this tab.") + '</span></div></div>';

    html += '<div class="report-grid">' +
      '<div class="stat"><div class="k">Coverage</div><div class="v">' + report.coveragePct + '%</div></div>' +
      '<div class="stat"><div class="k">Topics covered</div><div class="v">' + report.coveredLeaves + '/' + report.totalLeaves + '</div></div>' +
      '<div class="stat"><div class="k">Errors</div><div class="v">' + report.errorCount + '</div></div>' +
      '<div class="stat"><div class="k">Warnings</div><div class="v">' + report.warnCount + '</div></div>' +
      '</div>';

    if (report.errors.length) {
      html += '<ul class="issue-list">' + report.errors.map(function (e) {
        return '<li class="issue ' + e.level + '"><span>◆</span><span>' + escapeHtml(e.message) +
          ' <span class="code">[' + escapeHtml(e.code) + ']</span></span></li>';
      }).join("") + '</ul>';
    }

    html += '<div class="panel"><div class="panel-head"><h2>Topic-by-topic audit</h2>' +
      '<p>Green = covered, amber = thin, red = missing. Parents are complete only when all children are.</p></div>' +
      '<div class="outline-tree">' + report.tree.map(function (t) { return treeNodeHtml(t, report); }).join("") + '</div></div>';
    el.coverageReport.innerHTML = html;
  }

  function renderOutline(report) {
    el.outlineTree.innerHTML = report.tree.map(function (t) { return treeNodeHtml(t, report); }).join("");
  }

  /* ---------- Big reading card ---------- */
  function modalOpen() { return !el.cardModal.classList.contains("hidden"); }

  function applyReveal() {
    el.modalAnswerWrap.classList.toggle("hidden", !state.modalRevealed);
    el.modalReveal.textContent = state.modalRevealed ? "Hide answer" : "Show answer";
    el.modalReveal.classList.toggle("primary", !state.modalRevealed);
  }

  function restoreAnswerScroll() {
    if (pendingAnswerScroll == null || !state.modalRevealed) return;
    el.modalBody.scrollTop = pendingAnswerScroll;
    pendingAnswerScroll = null;
  }

  function renderModal() {
    const chapter = currentChapter();
    const list = visibleCards(chapter);
    const card = list.filter(function (c) { return c.id === state.modalCardId; })[0];
    if (!card) { closeCard(); return; }

    const index = V.nodeIndex(chapter.outline);
    const topics = (card.topics || []).map(function (id) {
      return index[id] ? index[id].node.title : id;
    });
    const key = chapter.id + ":" + card.id;
    const known = state.known[key];
    el.modalType.className = "type-tag t-" + card.type;
    el.modalType.textContent = card.type;
    el.modalTopics.innerHTML = topics.map(function (t) { return '<span class="topic-tag">' + escapeHtml(t) + '</span>'; }).join("");
    el.modalQuestion.innerHTML = renderText(card.front, key);
    el.modalAnswer.innerHTML = renderText(card.back, key) + renderImages(card);
    el.modalPage.textContent = card.sourcePage ? "PDF p." + card.sourcePage : "";
    el.modalCounter.textContent = (list.indexOf(card) + 1) + " / " + list.length;

    el.modalReview.dataset.key = key;
    el.modalKnown.dataset.key = key;
    el.modalReview.classList.toggle("active", known === "review");
    el.modalKnown.classList.toggle("active", known === "known");
    applyReveal();
    restoreAnswerScroll();
  }

  let lastFocused = null;
  function openCard(id, revealed, answerScroll) {
    const chapter = currentChapter();
    const exists = (chapter.cards || []).some(function (c) { return c.id === id; });
    if (!exists) return;
    lastFocused = document.activeElement;
    state.modalCardId = id;
    state.modalRevealed = revealed === undefined ? true : !!revealed;
    pendingRange = null;
    pendingAnswerScroll = typeof answerScroll === "number" ? answerScroll : 0;
    el.cardModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    renderModal();
    capturePoint();
    renderSidebar();
    el.modalClose.focus();
  }

  function closeCard() {
    if (!modalOpen()) return;
    capturePoint(); // persist the card and answer state before clearing it
    el.cardModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    state.modalCardId = null;
    pendingRange = null;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    renderResumeBar();
  }

  function modalStep(delta) {
    const list = visibleCards(currentChapter());
    if (!list.length) return;
    const i = list.map(function (c) { return c.id; }).indexOf(state.modalCardId);
    const next = list[Math.min(list.length - 1, Math.max(0, i + delta))];
    if (next && next.id !== state.modalCardId) {
      state.modalCardId = next.id;
      state.modalRevealed = true;
      pendingRange = null;
      pendingAnswerScroll = 0;
      renderModal();
      capturePoint();
      renderResumeBar();
    }
  }

  /* ---------- Reader's 3-colour highlighter ---------- */
  function currentKey() { return state.chapterId + ":" + state.modalCardId; }

  function domOffset(container, node, offset) {
    let total = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (n === node) return total + offset;
      total += n.nodeValue.length;
    }
    return total;
  }

  function captureSelection() {
    pendingRange = null;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!el.modalAnswer.contains(range.commonAncestorContainer)) return;
    const a = domOffset(el.modalAnswer, range.startContainer, range.startOffset);
    const b = domOffset(el.modalAnswer, range.endContainer, range.endOffset);
    if (b > a) pendingRange = { start: Math.min(a, b), end: Math.max(a, b) };
  }

  function applyHighlight(color) {
    if (!pendingRange || !state.modalCardId) {
      toast("Select text in the answer first");
      return;
    }
    const key = currentKey();
    const list = state.highlights[key] || [];
    const r = pendingRange;
    const kept = list.filter(function (x) { return !(r.start < x.end && r.end > x.start); });
    kept.push({ start: r.start, end: r.end, color: color });
    state.highlights[key] = kept;
    saveHighlights();
    pendingRange = null;
    if (window.getSelection) window.getSelection().removeAllRanges();
    renderModal();
    renderCards(currentChapter());
    toast("Highlighted " + color);
  }

  function removeHighlight(start, end) {
    const key = currentKey();
    if (!state.highlights[key]) return;
    state.highlights[key] = state.highlights[key].filter(function (x) {
      return !(x.start === start && x.end === end);
    });
    if (!state.highlights[key].length) delete state.highlights[key];
    saveHighlights();
    renderModal();
    renderCards(currentChapter());
    toast("Highlight removed");
  }

  el.modalAnswer.addEventListener("mouseup", captureSelection);
  el.modalAnswer.addEventListener("keyup", captureSelection);
  el.modalBody.addEventListener("scroll", function () {
    clearTimeout(capturePoint._t);
    capturePoint._t = setTimeout(capturePoint, 200);
  });

  /* ---------- Render all ---------- */
  function render() {
    const chapter = currentChapter();
    if (!chapter) return;
    const report = V.validateChapter(chapter);
    renderSidebar();
    renderHeader(chapter, report);
    renderFilters(chapter);
    renderCards(chapter);
    renderResumeBar();
    renderCoverage(chapter, report);
    renderOutline(report);
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.view === state.view);
    });
    ["cards", "coverage", "outline"].forEach(function (v) {
      document.getElementById("view-" + v).classList.toggle("hidden", v !== state.view);
    });
  }

  /* ---------- Events ---------- */
  document.addEventListener("click", function (ev) {
    const swatch = ev.target.closest("[data-hl-color]");
    if (swatch) { applyHighlight(swatch.dataset.hlColor); return; }
    if (ev.target.closest("#hlClear")) {
      if (!state.modalCardId) return;
      delete state.highlights[currentKey()];
      saveHighlights();
      renderModal();
      renderCards(currentChapter());
      toast("Highlights cleared");
      return;
    }
    if (ev.target.closest("#modalLink")) {
      if (!state.modalCardId) return;
      const u = location.origin + location.pathname + "?card=" + encodeURIComponent(state.modalCardId);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(u).then(function () { toast("Card link copied"); },
          function () { prompt("Copy this card link:", u); });
      } else { prompt("Copy this card link:", u); }
      return;
    }
    const userMark = ev.target.closest("mark.user-hl");
    if (userMark) {
      removeHighlight(Number(userMark.dataset.hs), Number(userMark.dataset.he));
      return;
    }
    if (ev.target.closest("#resumeOpen")) {
      const info = resumeTargetInfo();
      if (info) openCard(info.card.id, info.point.revealed !== false, info.point.scrollTop || 0);
      return;
    }
    if (ev.target.closest("#resumeDismiss")) {
      const point = chapterPoint(state.chapterId);
      delete point.cardId;
      delete point.scrollTop;
      capturePoint();
      renderSidebar();
      renderResumeBar();
      toast("Resume point cleared");
      return;
    }
    if (ev.target.closest("[data-close-modal]") || ev.target.closest("#modalClose")) {
      closeCard(); return;
    }
    const nav = ev.target.closest("[data-modal-nav]");
    if (nav) { modalStep(Number(nav.dataset.modalNav)); return; }
    if (ev.target.closest("#modalReveal")) {
      state.modalRevealed = !state.modalRevealed;
      applyReveal();
      if (state.modalRevealed) {
        if (pendingAnswerScroll == null) el.modalBody.scrollTop = 0;
        restoreAnswerScroll();
      }
      capturePoint();
      return;
    }

    const subjBtn = ev.target.closest("[data-subject]");
    if (subjBtn) {
      const subject = subjBtn.dataset.subject;
      state.expandedSubjects[subject] = !state.expandedSubjects[subject];
      saveSubjects();
      renderSidebar();
      return;
    }

    const chBtn = ev.target.closest("[data-chapter]");
    if (chBtn) {
      closeCard(); // saves the outgoing chapter's last card
      if (chBtn.dataset.chapter === state.chapterId) return;
      state.chapterId = chBtn.dataset.chapter;
      restoreChapterUi(); // its own filter, search and reveal state
      capturePoint();
      render();
      return;
    }
    const tab = ev.target.closest("[data-view]");
    if (tab) { state.view = tab.dataset.view; render(); return; }
    const chip = ev.target.closest("[data-type]");
    if (chip) {
      state.typeFilter = chip.dataset.type;
      capturePoint();
      renderCards(currentChapter());
      renderFilters(currentChapter());
      renderResumeBar();
      return;
    }
    const opener = ev.target.closest("[data-open]");
    if (opener) { openCard(opener.dataset.open); return; }
    const act = ev.target.closest("[data-act]");
    if (act) {
      ev.stopPropagation();
      const key = act.dataset.key;
      state.known[key] = act.dataset.act;
      saveKnown();
      renderCards(currentChapter());
      if (modalOpen()) renderModal();
      toast(act.dataset.act === "known" ? "Marked as known" : "Marked for review");
    }
  });

  el.search.addEventListener("input", function (e) {
    state.search = e.target.value;
    renderCards(currentChapter());
    renderResumeBar();
    clearTimeout(saveProgress._t);
    saveProgress._t = setTimeout(capturePoint, 250);
  });

  window.addEventListener("pagehide", capturePoint);

  document.addEventListener("keydown", function (e) {
    if (modalOpen()) {
      if (e.key === "Escape") { e.preventDefault(); closeCard(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault(); modalStep(e.key === "ArrowRight" ? 1 : -1); return;
      }
      if (e.key === " " && e.target.tagName !== "BUTTON") {
        e.preventDefault();
        state.modalRevealed = !state.modalRevealed;
        applyReveal();
        if (state.modalRevealed) {
          if (pendingAnswerScroll == null) el.modalBody.scrollTop = 0;
          restoreAnswerScroll();
        }
        capturePoint();
      }
      return;
    }
    if (e.target.tagName === "INPUT") return;
    const card = document.activeElement && document.activeElement.closest ? document.activeElement.closest(".card") : null;
    if (e.key === " " && card) { e.preventDefault(); openCard(card.dataset.id); return; }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && card) {
      const cards = Array.from(document.querySelectorAll(".card"));
      const i = cards.indexOf(card);
      const next = cards[i + (e.key === "ArrowRight" ? 1 : -1)];
      if (next) { e.preventDefault(); next.focus(); }
    }
  });

  init: {
    if (!chapters.length) {
      el.chapterTitle.textContent = "No chapters found — edit js/data.js";
    } else {
      /* Deep links from MedArena practice explanations / revisions:
         ?card=<card id> opens one card, ?q=<term> runs a full-text search. */
      const params = new URLSearchParams(location.search);
      const deepCard = params.get("card");
      const deepQ = params.get("q");
      const cardOwner = deepCard ? chapters.find(function (ch) {
        return (ch.cards || []).some(function (c) { return c.id === deepCard; });
      }) : null;
      const savedChapter = state.progress.activeChapterId;
      if (savedChapter && chapters.some(function (c) { return c.id === savedChapter; })) {
        state.chapterId = savedChapter;
      }
      if (cardOwner) state.chapterId = cardOwner.id;
      restoreChapterUi();
      if (cardOwner || deepQ) {
        state.view = "cards";
        state.typeFilter = "all";
        state.search = deepQ ? String(deepQ) : "";
        if (el.search) el.search.value = state.search;
      }
      capturePoint();
      render();
      if (deepCard) {
        if (cardOwner) openCard(deepCard);
        else toast("That card was not found — showing the chapter instead.");
      }
    }
  }
})();
