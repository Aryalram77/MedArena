#!/usr/bin/env node
/* Terminal coverage check. Run: node tools/validate.js */
const path = require("path");
const { CHAPTERS } = require(path.join(__dirname, "..", "js", "data.js"));
const V = require(path.join(__dirname, "..", "js", "validator.js"));

const result = V.validateAll(CHAPTERS);

console.log("\nCHAPTER COVERAGE REPORT");
console.log("=".repeat(64));
result.reports.forEach(function (r) {
  console.log("\n" + r.chapterId + "  " + r.title);
  console.log("  coverage : " + r.coveragePct + "%  (" + r.coveredLeaves + "/" + r.totalLeaves + " topics)");
  console.log("  errors   : " + r.errorCount + "   warnings: " + r.warnCount);
  if (r.missing.length) {
    console.log("  MISSING TOPICS:");
    r.missing.forEach(function (m) {
      console.log("    - " + m.id + "  " + m.title + (m.page ? "  (p." + m.page + ")" : ""));
    });
  }
  r.errors.forEach(function (e) {
    if (e.level === "warn") console.log("  [warn] " + e.code + ": " + e.message);
  });
});
console.log("\n" + "-".repeat(64));
console.log("TOTAL: " + result.totals.coveragePct + "%  |  " + result.totals.covered + "/" + result.totals.leaves +
  " topics  |  passed chapters: " + result.totals.passed + "/" + CHAPTERS.length +
  "  |  errors: " + result.totals.errors + "  warnings: " + result.totals.warns);
console.log("=".repeat(64) + "\n");

if (result.totals.errors > 0) process.exit(1);
