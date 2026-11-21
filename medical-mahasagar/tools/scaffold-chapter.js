#!/usr/bin/env node
/*
 * Turn a pasted heading list into a chapter outline skeleton.
 * Indent 2 spaces per level. Add @pNN at the end of a line for a page number.
 *
 *   node tools/scaffold-chapter.js "Breast" tools/headings.txt > chapter.js
 */
const fs = require("fs");

function buildChapter(title, lines, options) {
  options = options || {};
  const root = [];
  const stack = [];

  lines.forEach(function (raw) {
    if (!raw.trim()) return;
    const m = raw.match(/^(\s*)(.*)$/);
    const indent = m[1].replace(/\t/g, "  ").length;
    const depth = Math.floor(indent / 2);
    let text = m[2].trim();
    let page = null;
    const pm = text.match(/@p(?:age)?\s*[:\-]?\s*(\d+)\s*$/i);
    if (pm) { page = Number(pm[1]); text = text.replace(pm[0], "").trim(); }
    const parent = stack[depth - 1] || null;
    const siblings = parent ? parent.children : root;
    const id = parent ? parent.id + "." + (siblings.length + 1) : String(root.length + 1);
    const node = { id: id, title: text };
    if (page) node.page = page;
    siblings.push(node);
    stack[depth] = node;
    stack.length = depth + 1;
  });

  return {
    id: options.id || "ch__" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    number: options.number || null,
    title: title,
    status: "draft",
    source: { file: options.file || "", pageRange: options.pageRange || "" },
    outline: root,
    cards: []
  };
}

if (require.main === module) {
  const title = process.argv[2] || "Untitled Chapter";
  const file = process.argv[3];
  if (!file) {
    console.error("Usage: node tools/scaffold-chapter.js \"Chapter title\" headings.txt");
    process.exit(1);
  }
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const chapter = buildChapter(title, lines, {
    id: process.env.CH_ID,
    number: process.env.CH_NUM ? Number(process.env.CH_NUM) : null,
    file: process.env.PDF_FILE || "",
    pageRange: process.env.PDF_PAGES || ""
  });
  console.log("// Paste this object into js/data.js, then add >=1 card per leaf topic.");
  console.log(JSON.stringify(chapter, null, 2));
}

module.exports = { buildChapter: buildChapter };
