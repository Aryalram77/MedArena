/* Pragati Bibaran — taxonomy shared by the tracker and the dashboard.
 *
 * The existing app has no subject column on questions. This module derives a
 * stable subject/chapter from the bank id and the free-text chapter label so
 * the same mapping is used when an answer is recorded and when it is analysed.
 * Unknown questions are labelled "mixed" and never count towards a subject's
 * weighted progress.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PragatiTaxonomy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SUBJECTS = [
    { id: "medicine",          name: "Medicine",                  nameNp: "चिकित्सा",          group: "clinical", marks: 18, banks: ["medicine", "cee1", "cee3", "cee4", "cee5", "cee6", "cee2026", "neuro"] },
    { id: "surgery",           name: "Surgery",                   nameNp: "शल्यचिकित्सा",      group: "clinical", marks: 18, banks: ["se1", "surgery2", "surgery3", "cee1", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "obg",               name: "Obstetrics & Gynecology",   nameNp: "स्त्रीरोग तथा प्रसूति", group: "clinical", marks: 12, banks: ["cee1", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "pediatrics",        name: "Pediatrics",                nameNp: "बालचिकित्सा",       group: "clinical", marks: 12, banks: ["cee1", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "orthopedics",       name: "Orthopedics",               nameNp: "हड्डीरोग",          group: "clinical", marks: 10, banks: ["ortho", "cee1", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "ent",               name: "ENT",                       nameNp: "कर्ण-नासा-घाँटी",    group: "clinical", marks: 10, banks: ["ent", "cee1", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "ophthalmology",     name: "Ophthalmology",             nameNp: "नेत्रविज्ञान",       group: "clinical", marks: 7,  banks: ["ophtho", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "anesthesia",        name: "Anesthesiology",            nameNp: "संज्ञाहरण",         group: "clinical", marks: 7,  banks: ["cee1", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "psychiatry",        name: "Psychiatry",                nameNp: "मानसिक स्वास्थ्य",   group: "clinical", marks: 7,  banks: ["psychiatry", "cee1", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "radiology",         name: "Radiology",                 nameNp: "रेडियोलोजी",         group: "clinical", marks: 7,  banks: ["radiology", "cee1", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "dermatology",       name: "Dermatology",               nameNp: "छालारोग",           group: "clinical", marks: 7,  banks: ["dermatology", "cee1", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "anatomy",           name: "Anatomy",                   nameNp: "शरीररचना",          group: "basic", marks: 12, banks: ["anatomy", "cee1", "cee3", "cee4", "cee5", "cee6"] },
    { id: "physiology",        name: "Physiology",                nameNp: "शरीरक्रिया",         group: "basic", marks: 12, banks: ["physiology", "cee3", "cee4", "cee5", "cee6"] },
    { id: "pathology",         name: "Pathology",                 nameNp: "रोगविज्ञान",         group: "basic", marks: 10, banks: ["patho", "hema", "cee1", "cee3", "cee4", "cee5", "cee6"] },
    { id: "pharmacology",      name: "Pharmacology",              nameNp: "औषधविज्ञान",        group: "basic", marks: 10, banks: ["pharmacology", "cee1", "cee3", "cee4", "cee5", "cee6"] },
    { id: "biochemistry",      name: "Biochemistry",              nameNp: "जैवरसायन",          group: "basic", marks: 8,  banks: ["biochemistry", "cee1", "cee3", "cee4", "cee5", "cee6"] },
    { id: "microbiology",      name: "Microbiology",              nameNp: "सूक्ष्मजीवविज्ञान",  group: "basic", marks: 8,  banks: ["microbiology", "cee1", "cee3", "cee4", "cee5", "cee6"] },
    { id: "community",         name: "Community Medicine",        nameNp: "सामुदायिक चिकित्सा", group: "basic", marks: 6,  banks: ["psm", "cee3", "cee4", "cee5", "cee6", "cee2026"] },
    { id: "research",          name: "Research Methodology",      nameNp: "अनुसन्धान पद्धति",   group: "basic", marks: 4,  banks: ["cpd", "psm"] },
    { id: "forensic",          name: "Forensic Medicine",         nameNp: "न्यायिक चिकित्सा",   group: "basic", marks: 5,  banks: ["forensic", "cee1", "cee3", "cee4", "cee5", "cee6"] },
    { id: "cpd",               name: "Mandatory CPD",             nameNp: "अनिवार्य सीपीडी",    group: "basic", marks: 10, banks: ["cpd"] }
  ];

  var MIXED = { id: "mixed", name: "Mixed / Unmapped", nameNp: "मिश्रित", group: "other", marks: 0, banks: [] };

  var BY_ID = {};
  SUBJECTS.forEach(function (s) { BY_ID[s.id] = s; });
  BY_ID[MIXED.id] = MIXED;

  // A bank whose whole content belongs to one blueprint subject.
  var BANK_SUBJECT = {
    se1: "surgery", surgery2: "surgery", surgery3: "surgery",
    ophtho: "ophthalmology", psychiatry: "psychiatry", forensic: "forensic",
    ortho: "orthopedics", ent: "ent", physiology: "physiology",
    radiology: "radiology", anatomy: "anatomy", biochemistry: "biochemistry",
    pharmacology: "pharmacology", psm: "community", dermatology: "dermatology",
    patho: "pathology", hema: "pathology", neuro: "medicine", medicine: "medicine",
    microbiology: "microbiology", nursingconcept: "mixed"
  };

  // Ordered rules: first match wins. More specific rules must be earlier.
  var CHAPTER_RULES = [
    ["research", /research|study design|sampling|sample size|data analysis|data collection|biostatistic|publication ethics|validity of studies|measurement of study variables|measures of disease frequency|research question/],
    ["cpd", /ethics|bls|acls|constitution of nepal|medico-legal|medical negligence|dying declaration|offences relating|sexual offences|program|immunization|family planning|safe motherhood|cb-imnci|primary health care|outbreak surveillance|disaster management|deprived citizens|malaria control|kala-azar|lymphatic filariasis|dengue control|zoonotic|leprosy control|tuberculosis control|hiv and sti/],
    ["psychiatry", /psychiatr|psychosis|depression|substance use|organic mental|personality disorder|eating disorder|sleep disorder|sexual disorder|psychoanalysis|\bect\b/],
    ["dermatology", /dermatolog|skin |skin$|leprosy|scabies|fungal infection|sexually transmitted/],
    ["ophthalmology", /ophthalm|ocular|glaucoma|retina|cornea|refraction|strabismus|uveal/],
    ["ent", /\bent\b|otorhinolaryng|ear$|hearing|vestibular|nasal|sinus|larynx|pharynx|tonsil/],
    ["orthopedics", /orthoped|orthopaed|fracture|bone and joint|joint disorders|spine injury|sports injury/],
    ["anesthesia", /anaesthe|anesthe|perioperative|acls|bls/],
    ["radiology", /radiolog|radiotherapy|nuclear scan|image based/],
    ["forensic", /forensic|medical jurisprudence|autopsy|thanatology|asphyxia|firearm|poison|toxicolog|bloodstain|postmortem/],
    ["anatomy", /anatom|embryolog|histolog|neuroanatom|perineum|vertebral column/],
    ["physiology", /physiolog|cardiac output|membrane potential|lung volumes|gaseous exchange/],
    ["pathology", /patholog|cell injury|inflammation|neoplasia|hemodynamics|hematolog|haematolog|anemia|neutrophil|platelet/],
    ["pharmacology", /pharmacolog|chemotherap|antimicrobial|antineoplastic|drug dependence/],
    ["biochemistry", /biochemistr|enzyme|metabolis/],
    ["microbiology", /microbiolog|bacteriolog|virolog|parasitolog/],
    ["community", /community medicine|public health|\bpsm\b|social sciences|environment and health|health education|biomedical waste|nutrition and health|demography|family planning|communicable and non-communicable|screening of disease|epidemiology and vaccines|general health services/],
    ["obg", /obstet|gynaec|gynec|\bobg\b|gyn/],
    ["pediatrics", /pediatric|paediatric/],
    ["medicine", /medicine|cardiology|neurology|gastroenter|hepatolog|renal|pulmonolog|endocrinol|rheumatolog|infectious disease|emergency medicine|medical practice|urology/],
    ["surgery", /surgery|surgical|breast|thyroid|parathyroid|portal hypertension|gallbladder|bile duct|pancreas|esophagus|hernia|colostomy|burns|transplant|laparoscop/]
  ];

  function normalizeChapter(chapter) {
    return String(chapter || "General").replace(/\s+/g, " ").trim() || "General";
  }

  function subjectFromChapter(bankId, chapter) {
    var bank = String(bankId || "");
    if (Object.prototype.hasOwnProperty.call(BANK_SUBJECT, bank)) {
      // CPD contains research, ethics and national programmes — split it by
      // chapter instead of forcing the entire bank into one blueprint subject.
      if (bank !== "cpd") return BANK_SUBJECT[bank];
    }
    var text = normalizeChapter(chapter).toLowerCase();
    if (bank === "cpd" && /^(microbiology|pathology|anatomy|physiology|pharmacology|biochemistry|forensic)/.test(text)) {
      return "mixed";
    }
    for (var i = 0; i < CHAPTER_RULES.length; i++) {
      if (CHAPTER_RULES[i][1].test(text)) return CHAPTER_RULES[i][0];
    }
    return "mixed";
  }

  function questionKey(bankId, question) {
    var stem = (question && (question.stem || question.front)) || "";
    return String(bankId || "") + "|" + String(stem).slice(0, 120);
  }

  /* Compact 8-hex digest used by the static question index. FNV-1a forward +
     reversed gives two independent 32-bit values with negligible collision
     risk at this corpus size, while keeping the generated JSON small. */
  function hashKey(key) {
    var s = String(key || "");
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) {
      h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 ^= s.charCodeAt(s.length - 1 - i); h2 = Math.imul(h2, 0x811c9dc5) >>> 0;
    }
    return ("00000000" + h1.toString(16)).slice(-8) + ("00000000" + h2.toString(16)).slice(-8);
  }

  function mapQuestion(bankId, question) {
    var chapter = normalizeChapter(question && question.chapter);
    var subjectId = subjectFromChapter(bankId, chapter);
    var subject = BY_ID[subjectId] || MIXED;
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      chapter: chapter,
      questionKey: questionKey(bankId, question),
      bankId: String(bankId || ""),
      counted: subject.id !== "mixed"
    };
  }

  function practiceUrl(bankId, chapter) {
    var params = new URLSearchParams();
    if (bankId) params.set("bank", bankId);
    if (chapter) params.set("ch", chapter);
    var qs = params.toString();
    return "surgery-practice.html" + (qs ? "?" + qs : "");
  }

  return {
    SUBJECTS: SUBJECTS,
    MIXED: MIXED,
    TOTAL_MARKS: 200,
    subject: function (id) { return BY_ID[id] || MIXED; },
    subjectFromChapter: subjectFromChapter,
    questionKey: questionKey,
    hashKey: hashKey,
    mapQuestion: mapQuestion,
    normalizeChapter: normalizeChapter,
    practiceUrl: practiceUrl
  };
});
