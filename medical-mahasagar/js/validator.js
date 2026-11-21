/*
 * Coverage validator — shared by the browser app and the Node CLI.
 *
 * The contract that makes "nothing left out" checkable:
 *   1. A chapter declares an `outline` tree. Every LEAF is a required topic.
 *   2. Every card declares `topics: [leafId, ...]`.
 *   3. A chapter passes only when every leaf has >= 1 card and there are no
 *      structural errors. Warnings flag thin or unbalanced coverage.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CardValidator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CORE_TYPES = ["concept", "definition", "example", "summary"];
  const STRUCTURE_TYPES = ["process", "compare", "figure", "clinical", "fact"];
  const THIN_TYPES = ["fact", "definition"];

  function walk(nodes, fn, depth, parent) {
    depth = depth || 0;
    (nodes || []).forEach(function (node) {
      fn(node, depth, parent || null);
      walk(node.children, fn, depth + 1, node);
    });
  }

  function nodeIndex(outline) {
    const map = {};
    walk(outline, function (node, depth, parent) {
      map[node.id] = { node: node, depth: depth, parent: parent };
    });
    return map;
  }

  function flattenLeaves(outline) {
    const leaves = [];
    walk(outline, function (node, depth, parent) {
      if (!node.children || !node.children.length) {
        const path = [];
        let cur = parent;
        while (cur) { path.unshift(cur.title); cur = cur.parent; }
        leaves.push({ id: node.id, title: node.title, page: node.page || null, depth: depth, path: path });
      }
    });
    return leaves;
  }

  function validateChapter(chapter) {
    const errors = [];
    const stats = {};
    const index = nodeIndex(chapter.outline);
    const leaves = flattenLeaves(chapter.outline);
    const cards = chapter.cards || [];

    function add(level, code, message, extra) {
      const item = { level: level, code: code, message: message };
      if (extra) Object.keys(extra).forEach(function (k) { item[k] = extra[k]; });
      errors.push(item);
    }

    Object.keys(index).forEach(function (id) { stats[id] = { count: 0, types: [], cardIds: [] }; });

    const seen = {};
    cards.forEach(function (card) {
      if (!card.id) add("error", "NO_CARD_ID", "A card has no id.");
      else if (seen[card.id]) add("error", "DUPLICATE_CARD_ID", "Duplicate card id: " + card.id, { id: card.id });
      else seen[card.id] = true;

      if (!card.front || !card.back) add("error", "EMPTY_CARD", "Card " + card.id + " needs both a front and a back.", { id: card.id });
      if (!card.type) add("error", "NO_TYPE", "Card " + card.id + " has no type.", { id: card.id });

      const topics = card.topics || [];
      if (!topics.length) add("error", "NO_TOPIC", "Card " + card.id + " is not linked to any outline topic.", { id: card.id });
      topics.forEach(function (tid) {
        if (!index[tid]) add("error", "UNKNOWN_TOPIC", "Card " + card.id + " references unknown topic " + tid + ".", { id: card.id, topic: tid });
        else {
          stats[tid].count += 1;
          stats[tid].cardIds.push(card.id);
          if (stats[tid].types.indexOf(card.type) === -1) stats[tid].types.push(card.type);
        }
      });
    });

    // A node is covered if it has its own cards, or all of its children are covered.
    function evaluate(node, depth) {
      const own = (stats[node.id] || { count: 0 }).count;
      const kids = (node.children || []).map(function (c) { return evaluate(c, depth + 1); });
      const childrenCovered = kids.length > 0 && kids.every(function (k) { return k.covered; });
      return { node: node, depth: depth, own: own, children: kids, covered: own > 0 || childrenCovered };
    }
    const tree = chapter.outline.map(function (n) { return evaluate(n, 0); });

    const missing = leaves.filter(function (leaf) { return (stats[leaf.id] || { count: 0 }).count === 0; });
    missing.forEach(function (leaf) {
      add("error", "MISSING_TOPIC", '"' + leaf.title + '" (' + leaf.id + ') has no card.', { topic: leaf.id, title: leaf.title });
    });

    // Balance checks: do not let a chapter pass on facts/definitions alone.
    const typesUsed = {};
    cards.forEach(function (c) { if (c.type) typesUsed[c.type] = (typesUsed[c.type] || 0) + 1; });
    CORE_TYPES.forEach(function (t) {
      // Some sources deliberately exclude clinical vignettes (e.g. question-bank
      // material hosted elsewhere). Such chapters opt out of the example warning.
      if (t === "example" && chapter.excludeExamples) return;
      if (!typesUsed[t]) add("warn", "NO_" + t.toUpperCase() + "_CARDS", "No '" + t + "' card in this chapter — deep understanding usually needs one.");
    });
    if (!STRUCTURE_TYPES.some(function (t) { return typesUsed[t]; })) {
      add("warn", "NO_STRUCTURE_CARDS", "No process/compare/figure/clinical card — add at least one active-structure card.");
    }
    leaves.forEach(function (leaf) {
      const s = stats[leaf.id];
      if (s && s.count === 1 && s.types.length === 1 && THIN_TYPES.indexOf(s.types[0]) !== -1) {
        add("warn", "THIN_TOPIC", '"' + leaf.title + '" (' + leaf.id + ') is covered by a single recall card only.', { topic: leaf.id });
      }
    });

    const coveredLeaves = leaves.length - missing.length;
    const coveragePct = leaves.length ? Math.round((coveredLeaves / leaves.length) * 100) : 0;
    const errorCount = errors.filter(function (e) { return e.level === "error"; }).length;
    const warnCount = errors.length - errorCount;

    return {
      chapterId: chapter.id,
      title: chapter.title,
      stats: stats,
      tree: tree,
      leaves: leaves,
      missing: missing,
      coveragePct: coveragePct,
      coveredLeaves: coveredLeaves,
      totalLeaves: leaves.length,
      errors: errors,
      errorCount: errorCount,
      warnCount: warnCount,
      passed: errorCount === 0 && leaves.length > 0
    };
  }

  function validateAll(chapters) {
    const reports = (chapters || []).map(validateChapter);
    const totals = reports.reduce(function (acc, r) {
      acc.leaves += r.totalLeaves;
      acc.covered += r.coveredLeaves;
      acc.errors += r.errorCount;
      acc.warns += r.warnCount;
      if (r.passed) acc.passed += 1;
      return acc;
    }, { leaves: 0, covered: 0, errors: 0, warns: 0, passed: 0 });
    totals.coveragePct = totals.leaves ? Math.round((totals.covered / totals.leaves) * 100) : 0;
    return { reports: reports, totals: totals };
  }

  return {
    walk: walk,
    nodeIndex: nodeIndex,
    flattenLeaves: flattenLeaves,
    validateChapter: validateChapter,
    validateAll: validateAll
  };
});
