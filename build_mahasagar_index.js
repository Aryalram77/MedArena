/* Build a compact keyword index for Medical Mahasagar chapter cards.
   The full data.js (27 MB) stays inside the Mahasagar page; the practice page
   only fetches this small index so it can match cards by keyword instantly.
   Run:  node build_mahasagar_index.js                                      */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const ROOT = __dirname;
const requireHere = createRequire(path.join(ROOT, 'package.json'));
const { CHAPTERS } = requireHere('./medical-mahasagar/js/data.js');
const OUT = path.join(ROOT, 'medical-mahasagar', 'card-search-index.json');

const STOP = new Set(('a an the and or of in on at to for with by from is are was were be been being it its as this that these those ' +
  'what which who when where why how do does did can could should would may might will just about into than then there here any all some no not if but ' +
  'you your they them their he she his her we our i me my also more most less very each every other another same such only own too can will ' +
  'following following: question answer answers option options given regarding respectively following statements statement true false correct incorrect ' +
  'patient patients case study disease diseases disorder disorders condition conditions due caused cause causes result results lead leads ' +
  'one two three four five first second third last next before after between during while without within against among over under above below ' +
  'find found see seen known given use used using uses way ways time day year years old new good bad high low large small long short ' +
  'chapter topic section part page book source text table figure image fig refs reference references answer: q').split(/\s+/));

function clean(s) {
  return String(s == null ? '' : s)
    .replace(/==([^=]+)==/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function tokens(text, weight, bag) {
  String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).forEach(function (w) {
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) return;
    bag[w] = (bag[w] || 0) + (weight || 1);
  });
}
function cap(text, n) {
  if (text.length <= n) return text;
  return text.slice(0, n).replace(/\s+\S*$/, '') + '…';
}

const subjects = [];
const subjectIndex = {};
const chapters = [];
const cards = [];
let cardCount = 0;

CHAPTERS.forEach(function (ch) {
  const subject = ch.subject || 'Surgery';
  if (!(subject in subjectIndex)) { subjectIndex[subject] = subjects.length; subjects.push(subject); }
  const chapterIdx = chapters.length;
  chapters.push([ch.id, clean(ch.title), subjectIndex[subject]]);
  const chapterTitle = clean(ch.title) + ' ' + ch.id;

  (ch.cards || []).forEach(function (c) {
    const front = clean(c.front);
    const back = clean(c.back);
    const bag = {};
    tokens(front, 3, bag);
    tokens(back, 1, bag);
    tokens(chapterTitle, 2, bag);
    const words = Object.keys(bag).sort(function (a, b) {
      const sa = bag[a] * (1 + Math.log(a.length + 1) / 3);
      const sb = bag[b] * (1 + Math.log(b.length + 1) / 3);
      return sb - sa || a.localeCompare(b);
    }).slice(0, 12);
    cards.push([c.id, chapterIdx, cap(front, 150), cap(back, 240), words.join(' ')]);
    cardCount++;
  });
});

const payload = { v: 1, subjects: subjects, chapters: chapters, cards: cards };
fs.writeFileSync(OUT, JSON.stringify(payload), 'utf8');
console.log('wrote ' + path.basename(OUT) + ': ' + (fs.statSync(OUT).size / 1048576).toFixed(2) + ' MB');
console.log('subjects=' + subjects.length + ' chapters=' + chapters.length + ' cards=' + cardCount);
