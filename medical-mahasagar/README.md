# Chapter Cards

A no-build, chapter-wise flashcard app covering **sixteen source books**, each in its
own subject heading:

1. **Surgery** — Surgery Essence, 8/e (Pritesh Kumar Singh), chapters `ch01`–`ch51`
2. **Anatomy** — Self Assessment and Review of Anatomy (Rajesh K Kaushal, Jaypee
   2018), chapters `an01`–`an11`, numbered 1–11
3. **Pharmacology** — Review of Pharmacology, 12/e (Garg & Gupta), chapters
   `ph01`–`ph15`, numbered 1–15
4. **Biochemistry** — Self Assessment and Review of Biochemistry, 2/e (Rebecca
   James Perumcheril), chapters `bi01`–`bi18`, numbered 1–18
5. **Forensic Medicine** — Review of Forensic Medicine and Toxicology (Gautam
   Biswas), chapters `fm01`–`fm63` with chapter 2 omitted, numbered as in the book
6. **Pathology and Genetics** — Review of Pathology and Genetics, 10/e (Gobind Rai
   Garg & Sparsh Gupta), chapters `pg01`–`pg19`, numbered 1–19
7. **Orthopedics** — `orthoped.docx` (PDF-Based MCQ Extraction, Answer & Complete
   Chapter Revision), chapters `ortho02`–`ortho21`, numbered as in the document;
   only the **COMPLETE CHAPTER SUMMARY** sections are included
8. **ENT** — `ENT Sakshi arora E7.pdf` (Sakshi Arora Hans, *Self Assessment and
   Review: ENT*, 7/e), chapters `ent01`–`ent19`, `ent20a`/`ent20b`, and
   `ent21`–`ent30`, numbered as in the book (chapter 20 has two parts)
9. **Psychiatry** — `pdfcoffee.com_review-of-psychiatry-praveen-tripathi-1st-ed-2016-pdf-free.pdf`
   (Praveen Tripathi, *Review of Psychiatry*, 1/e, 2016), chapters `psy01`–`psy13`,
   numbered 1–13
10. **Opthalmology** — `pdfcoffee.com_self-assessment-and-review-of-ophthalmology-pdf-free.pdf`
    (Sudha Seetharam, *Self Assessment and Review of Ophthalmology*), chapters
    `oph01`–`oph12`, numbered 1–12
11. **Physiology** — `2 Physio manna E2.pdf` (Soumen Manna, *Review of Physiology*,
    2/e), chapters `phys00`–`phys19` (the Annexures plus book chapters 1–19)
12. **Radiology** — `Review_of_Radiology.pdf` (Rajat Jain and Virendra Jain,
    *Review of Radiology*), chapters `rad00`–`rad07` (the "Few Thumb Rules in
    Radiology" section plus book chapters 1–7)
13. **Gynecology** — `dokumen.pub_self-assessment-amp-review-gynecology-12nbsped.pdf`
    (Sakshi Arora Hans, *Self Assessment & Review: Gynecology*, 12/e), chapters
    `gy00`–`gy19` (Important Topics, Annexures, book chapters 1–14A–D and 15)
14. **OBS** — `sel&ass&rev&obs&12th.pdf` (Sakshi Arora Hans, *Self Assessment &
    Review: Obstetrics*, 12/e), chapters `obs01`–`obs29` (book chapters 1–28 plus the
    Latest Papers section)
15. **USMLE** — `dokumen.pub_first-aid-for-the-usmle-step-1-2025-35.pdf`
    (*First Aid for the USMLE Step 1 2025*), chapters `usmle01`–`usmle06`
    (Biochemistry: Molecular, Cellular, Laboratory Techniques, Genetics,
    Nutrition and Metabolism)
16. **Medicine** — `medicine1_part_1.pdf` (*Self Assessment & Review: Medicine*, 9/e,
    Mudit Khanna), chapters `med01`–`med08` (the Essential Revision Notes theory on
    PDF pages 20–59 and 250–267; question bank and explanations excluded, no images)

Cards are derived strictly from each chapter's source text. For fifteen subjects the
MCQ / question bank is deliberately **excluded** — those questions already live in the
user's website. OBS is the exception: at the user's request, its in-chapter questions
and answers and its Latest Papers section are included as teaching cards. (Three
surgery chapters — 41, 44, 51 — have no narrative section in the book; with approval
their cards come from the teaching prose in the answer-key Explanations, with the MCQ
stems/options still excluded. See "Current content" below.)

Key anatomy, pharmacology, biochemistry, radiology and USMLE figures, tables and
classifications are cropped from the PDFs and shown inside the relevant cards; see
[Card figures](#card-figures) below. Forensic Medicine, Pathology and Genetics,
Orthopedics, ENT, Psychiatry, Opthalmology, Physiology, Gynecology, OBS and Medicine
have **no cropped images** — their cards are text-only.

## Open it

Double-click `index.html`, or serve the folder:

```powershell
cd C:\Users\pc\chapter-cards
python -m http.server 8000
# then open http://localhost:8000
```

No install, no bundler, no dependencies. Everything is plain HTML/CSS/JS.

## What is in the app

| Tab | Purpose |
| --- | --- |
| **Cards** | Click a card to open it as a large reading card. Filter by type, full-text search, and mark *Review* / *Got it*. Progress is saved in `localStorage`. |
| **Coverage** | Pass/fail report plus a topic-by-topic audit. Green = covered, amber = thin, red = missing. |
| **Outline** | The chapter's heading tree with per-topic card counts and types. |

Keyboard in the grid: `Space` opens the focused card, `←` / `→` move between cards.
In the big card: `Space` shows/hides the answer, `←` / `→` move between cards, `Esc` closes.

### Subjects & the chapter list

Chapters are grouped by subject. There are sixteen groups: **Surgery** (51
chapters), **Anatomy** (11 chapters), **Pharmacology** (15 chapters), **Biochemistry**
(18 chapters), **Forensic Medicine** (62 chapters; original chapter 2 omitted),
**Pathology and Genetics** (19 chapters), **Orthopedics** (20 chapters),
**ENT** (31 chapters), **Psychiatry** (13 chapters), **Opthalmology** (12 chapters),
**Physiology** (20 chapters), **Radiology** (8 chapters), **Gynecology** (20 chapters),
**OBS** (29 chapters), **USMLE** (6 chapters) and **Medicine** (8 chapters). Each
heading is its own collapsible accordion: all start **collapsed**, and clicking a
heading expands just that group's chapter list (click again to collapse it). Each
group's expanded/collapsed state is saved independently in `localStorage`. A chapter
defaults to the **Surgery** group unless it explicitly declares its own `subject`
field — the anatomy, pharmacology, biochemistry, forensic, pathology, orthopedics,
ENT, psychiatry, opthalmology, physiology, radiology, gynecology, OBS, USMLE and
medicine chapters set `subject: "Anatomy"`, `subject: "Pharmacology"`,
`subject: "Biochemistry"`, `subject: "Forensic Medicine"`,
`subject: "Pathology and Genetics"`, `subject: "Orthopedics"`, `subject: "ENT"`,
`subject: "Psychiatry"`, `subject: "Opthalmology"`, `subject: "Physiology"`,
`subject: "Radiology"`, `subject: "Gynecology"`, `subject: "OBS"`,
`subject: "USMLE"` and `subject: "Medicine"` respectively, which is what puts them
in separate groups.

## Big card & highlights

Clicking any card opens a large, scrollable reading card with serif typography
(question ~32px, answer ~22px, generous line spacing). Its toolbar can hide/show the
answer, step to the previous/next card, and mark *Review* / *Got it* without leaving
the view.

Important text is colour-coded automatically:

| Colour | Meaning | Examples |
| --- | --- | --- |
| Yellow | key superlatives | `most common`, `drug of choice`, `IOC`, `MC` |
| Red | critical negations | `NOT`, `never`, `must`, `only`, `contraindicated` |
| Teal | medical terms / acronyms | `DCIS`, `LCIS`, `HER2`, `BIRADS`, `TRAM` |
| Purple | manual emphasis | any text wrapped in `**...**` in `data.js` |
| Amber + bold + underline | text that carried a superscript **Q** in the source PDF | written as `==phrase==` in `data.js` |

Use `**important phrase**` inside a card's `front` or `back` for manual purple
emphasis. For the PDF's superscript `Q` markers, wrap the exact marked phrase in
`==...==`; it renders as bold amber with an underline and takes precedence over
the automatic colours. Surgery chapters 3 through 51 are tagged this way; surgery
chapters 1 and 2 are the original untagged drafts. The **anatomy, pharmacology,
biochemistry, forensic, pathology, orthopedics, ENT, psychiatry, opthalmology,
physiology, radiology, gynecology, OBS and USMLE sources have no superscript-Q
markers**, so their cards contain no `==...==` syntax — the amber highlighting
applies only to the Surgery Essence chapters. USMLE cards instead use `**...**`
for the source book's real bold/high-yield phrases.

### Card figures

Some anatomy, pharmacology, biochemistry, radiology and USMLE cards carry an
`images: [...]` array of paths (relative to `index.html`) pointing to cropped
figures, tables and classifications from the source PDF. Forensic Medicine,
Pathology and Genetics, Orthopedics, ENT, Psychiatry, Opthalmology, Physiology,
Gynecology and OBS cards never carry `images`.
These are shown both on the small card back and, larger, in the big reading card —
with a caption giving the source PDF page. The crops live in `assets/images/`
(filenames `anNN_figNN.<ext>`, `phNN_figNNN.png`, `biNN_figNNN.png`,
`radNN_figNNN.jpeg` and `usmlebiopNNN.jpg`; the extension varies between `.jpeg`,
`.jpg` and `.png`). A card's figure is tied to the PDF page of the topic it
illustrates. Key figures only — not all figures in the books — are embedded.
For USMLE, every source page has a dedicated full-page visual-plate card so that
all images, tables, flowcharts and labeled diagrams on that page are represented.

### Your own highlighter

The big card's header has three swatches — **yellow**, **green** and **pink**.
Select any text in the answer (drag with the mouse or Shift+arrows), then click a
swatch to mark it. Highlights are saved per card in `localStorage` and also show
on the small card backs.

- Click a coloured mark to remove just that highlight
- The ✕ button clears all highlights on the current card
- Selecting overlapping text replaces the older mark
- Highlights are stored as character positions, so they survive re-renders and
  card navigation

### Resume where you left off

Study position is saved automatically per chapter in `localStorage` under
`chapter-cards:progress:v1`. Coming back to the app (or switching chapters)
restores:

- the chapter you were last in
- the exact card you were reading, with a **Resume card →** banner above the grid
- the active type filter and search text, so the card keeps its same position
- whether the answer was hidden or shown, plus the scroll position inside the card

The last card is ringed in the grid and auto-scrolled into view, and a `↺` marker
appears beside chapters that have a saved point. Clicking **Resume card** reopens
the big card exactly where you stopped. The `×` on the banner clears just that
chapter's resume point; filters and highlights are kept. Progress is also saved
when you navigate, hide/show the answer, scroll the card, or close the tab.

### Current content

- **Chapter 1 — Breast** (nipple discharge to gynecomastia)
  - Source: `surgeryrev_part_1.pdf`, **PDF pages 103–124** (book pp. 3–24), narrative only
  - **75 cards across 66 outline leaf topics — 100% coverage, 0 errors**
  - MCQ bank (PDF pages 125–148) and its explanation text are not represented
- **Chapter 2 — Thyroid**
  - Source: `surgeryrev_part_1.pdf`, **PDF pages 149–164** (book pp. 49–64), narrative only
  - **70 cards across 68 outline leaf topics — 100% coverage, 0 errors**
  - MCQ bank starts at PDF page 165 ("Multiple Choice Questions") and is excluded
- **Chapter 3 — Parathyroid and Adrenal Glands**
  - Source: `surgeryrev_part_1.pdf`, **PDF pages 187–194** (book pp. 87–94), narrative only
  - **48 cards across 46 outline leaf topics — 100% coverage, 0 errors**
  - MCQs and their explanations from PDF page 195 onward are excluded
  - Text that carried a superscript `Q` in the PDF is amber-bold-underlined (`==...==` in `data.js`)
- **Chapter 4 — Liver**
  - Source: `surgeryrev_part_1.pdf`, **PDF pages 207–219** (book pp. 107–119), narrative only
  - **95 cards across 90 outline leaf topics — 100% coverage, 0 errors**
  - MCQs and their explanations from PDF page 220 onward are excluded
  - All `Q`-superscripted phrases are amber-bold-underlined; 330 such highlights across 90 cards
- **Chapter 5 — Portal Hypertension**
  - Source: `surgeryrev_part_1.pdf`, **PDF pages 243–254** (book pp. 143–154), narrative only
  - **73 cards across 71 outline leaf topics — 100% coverage, 0 errors, 0 warnings**
  - MCQs and their explanations from PDF page 255 onward are excluded (PDF 238–242 are Chapter 4 MCQ answers)
  - All `Q`-superscripted phrases are amber-bold-underlined; 291 such highlights across 72 cards
- **Chapter 6 — Gallbladder**
  - Source: `surgeryrev_part_1.pdf`, **PDF pages 265–275** (book pp. 165–175), narrative only
  - **103 cards across 95 outline leaf topics — 100% coverage, 0 errors, 0 warnings**
  - MCQs and their explanations from PDF page 276 onward are excluded
  - All `Q`-superscripted phrases are amber-bold-underlined; 304 such highlights across 92 cards
- **Chapter 7 — Bile Duct**
  - Source: `surgeryrev_part_1.pdf`, **PDF pages 294–308** (book pp. 194–208), narrative only
  - **103 cards across 101 outline leaf topics — 100% coverage, 0 errors, 0 warnings**
  - MCQs and their explanations from PDF page 309 onward are excluded
  - All `Q`-superscripted phrases are amber-bold-underlined; 371 such highlights across 95 cards
- **Chapter 8 — Pancreas**
  - Source: `surgeryrev_part_1.pdf`, **PDF pages 326–344** (book pp. 226–244), narrative only
  - **117 cards across 110 outline leaf topics — 100% coverage, 0 errors, 0 warnings**
  - MCQs and their explanations from PDF page 345 onward are excluded
  - All `Q`-superscripted phrases are amber-bold-underlined; 442 such highlights across 105 cards
- **Chapter 9 — Esophagus**
  - Source: `surgeryrev_part_1.pdf`, **PDF pages 375–389** (book pp. 275–289), narrative only
  - **118 cards across 117 outline leaf topics — 100% coverage, 0 errors, 0 warnings**
  - MCQs and their explanations from PDF page 390 onward are excluded
  - All `Q`-superscripted phrases are amber-bold-underlined; 365 such highlights across 103 cards

#### Chapters 10–26 — `surgeryrev_part_2.pdf`

| Ch | Title | Narrative PDF pages | Cards | Topics |
|----|-------|---------------------|-------|--------|
| 10 | Stomach and Duodenum | 2–20 | 166 | 139 |
| 11 | Peritoneum | 53–58 | 101 | 52 |
| 12 | Intestinal Obstruction | 69–82 | 89 | 81 |
| 13 | Small Intestine | 97–109 | 134 | 95 |
| 14 | Large Intestine | 123–135 | 119 | 85 |
| 15 | Ileostomy and Colostomy | 156–158 | 36 | 19 |
| 16 | Inflammatory Bowel Disease | 161–166 | 64 | 36 |
| 17 | Vermiform Appendix | 176–181 | 94 | 58 |
| 18 | Rectum and Anal Canal | 188–197 | 88 | 68 |
| 19 | Hernia and Abdominal Wall | 213–222 | 102 | 74 |
| 20 | Spleen | 240–244 | 67 | 54 |
| 21 | Kidney and Ureter | 255–279 | 128 | 116 |
| 22 | Urinary Bladder | 314–321 | 114 | 69 |
| 23 | Prostate and Seminal Vesicles | 334–341 | 94 | 60 |
| 24 | Urethra and Penis | 350–358 | 110 | 75 |
| 25 | Testis and Scrotum | 372–384 | 137 | 105 |
| 26 | Arterial Disorders | 399–411 + part 3 PDF 1 | 105 | 91 |

Chapter 26 spans the two files: part 2 pages 399–411 plus part 3 page 1. Book
pages are 711–724; the MCQ bank begins at part 3 PDF page 2 and is excluded.

#### Chapters 27–51 — `surgeryrev_part_3.pdf`

| Ch | Title | Narrative PDF pages | Cards | Topics |
|----|-------|---------------------|-------|--------|
| 27 | Venous Disorders | 22–28 | 91 | 69 |
| 28 | Lymphatic System | 38–41 | 69 | 38 |
| 29 | Thorax and Lung | 47–65 | 117 | 110 |
| 30 | Burns | 92–97 | 63 | 44 |
| 31 | Plastic Surgery and Skin Lesions | 105–112 | 84 | 83 |
| 32 | Wound Healing, Tissue Repair and Scar | 128–132 | 74 | 45 |
| 33 | Cerebrovascular Diseases | 140–146 | 110 | 68 |
| 34 | CNS Tumors | 163–169 | 84 | 65 |
| 35 | Oral Cavity | 184–189 | 109 | 56 |
| 36 | Salivary Glands | 199–204 | 70 | 63 |
| 37 | Neck | 216–221 | 71 | 37 |
| 38 | Facial Injuries and Abnormalities | 229–232 | 55 | 38 |
| 39 | Oncology | 240–247 | 100 | 60 |
| 40 | Sarcoma | 261–264 | 63 | 33 |
| 41 | Pediatric Surgery | 271–272 (Explanations) | 28 | 14 |
| 42 | Trauma | 273–288 | 111 | 103 |
| 43 | Transplantation | 312–322 | 114 | 83 |
| 44 | Anesthesia and Perioperative Complications | 330–331 (Explanations) | 40 | 18 |
| 45 | Robotics, Laparoscopy and Bariatric Surgery | 332–337 | 86 | 46 |
| 46 | Sutures and Anastomoses | 342–346 | 76 | 50 |
| 47 | Sterilization and Infection | 354–361 | 95 | 54 |
| 48 | Fluid, Electrolyte and Nutrition | 374–377 | 70 | 43 |
| 49 | Blood Transfusion | 385–387 | 48 | 34 |
| 50 | Shock | 391–394 | 58 | 30 |
| 51 | Miscellaneous | 404–411 (Explanations) | 102 | 75 |

Every table row is **100% outline coverage, 0 errors**. Across all 51 surgery
chapters the app holds **4,538 cards**, **3,400 leaf topics**, and **12,090 amber
`Q` highlights**.

**Three special chapters (41, 44, 51):** the source book has no narrative section
for these — the chapter heading is followed straight by the MCQ bank. With the
user's approval, their cards were built from the substantive **teaching prose in
the answer-key Explanations** (ch41 PDF 271–272; ch44 PDF 330–331; ch51 PDF
404–411). MCQ stems, options, answer letters and reference citations were still
excluded; only the prose carrying superscript `Q` markers was used.

#### Chapters 1–11 (anatomy) — `Rajesh_K_Kaushal_...Anatomy_2018,_Jaypee.pdf`

These restart numbering at 1–11 but carry distinct IDs `an01`–`an11` so they never
collide with the surgery chapters. They sit in their own **Anatomy** sidebar group
(set via `subject: "Anatomy"`), sorted by number. Every row is **100% outline
coverage, 0 errors, 0 warnings**; the MCQ/assessment banks are excluded and key
figures are cropped into cards.

| Ch | Title | PDF pages | Cards | Topics | Figures used |
|----|-------|-----------|-------|--------|--------------|
| 1 | General Anatomy | 11–29 | 140 | 84 | 14 |
| 2 | Embryology | 30–157 | 840 | 584 | 113 |
| 3 | Histology | 158–233 | 481 | 265 | 79 |
| 4 | Neuroanatomy | 234–343 | 791 | 442 | 108 |
| 5 | Head and Neck | 344–549 | 1,121 | 833 | 221 |
| 6 | Back | 550–564 | 109 | 70 | 13 |
| 7 | Thorax | 565–636 | 570 | 293 | 59 |
| 8 | Upper Limb | 637–734 | 724 | 416 | 74 |
| 9 | Abdomen | 735–856 | 674 | 339 | 55 |
| 10 | Pelvis | 857–911 | 467 | 274 | 76 |
| 11 | Lower Limb | 912–999 | 787 | 388 | 82 |

Across the 11 anatomy chapters: **6,704 cards** and **3,988 leaf topics**, with
**894 cropped figure attachments**.

#### Chapters 1–15 (pharmacology) — `Review of pharmacology 12th edition.pdf`

These restart numbering at 1–15 with IDs `ph01`–`ph15`, in their own
**Pharmacology** sidebar group (via `subject: "Pharmacology"`), sorted by number.
Theory only — the Chapter Review pages, Golden Points and Annexure are covered;
Image Based Questions, MCQs and Explanations are excluded. Key tables,
classifications and figures are cropped into cards. Every row is **100% outline
coverage, 0 errors, 0 warnings**.

| Ch | Title | PDF pages | Cards | Topics | Figures used |
|----|-------|-----------|-------|--------|--------------|
| 1 | General Pharmacology | 50–65 | 219 | 95 | 13 |
| 2 | Autonomic Nervous System | 88–105 | 180 | 100 | 7 |
| 3 | Autacoids | 131–141 | 163 | 80 | 1 |
| 4 | Cardiovascular System | 155–177 | 248 | 120 | 3 |
| 5 | Kidney | 202–208 | 92 | 60 | 4 |
| 6 | Endocrinology | 216–237 | 176 | 108 | 16 |
| 7 | Central Nervous System | 266–289 | 229 | 136 | 8 |
| 8 | Anaesthesia | 328–340 | 171 | 79 | 2 |
| 9 | Hematology | 355–365 | 138 | 79 | 4 |
| 10 | Respiratory System | 378–383 | 84 | 52 | 3 |
| 11 | Gastrointestinal Tract | 390–399 | 113 | 73 | 6 |
| 12 | Chemotherapy A: General Considerations and Non-specific Antimicrobial Agents | 408–428 | 243 | 120 | 11 |
| 13 | Chemotherapy B: Antimicrobials for Specific Conditions | 456–475 | 206 | 323 | 10 |
| 14 | Chemotherapy C: Antineoplastic Drugs | 502–516 | 227 | 118 | 9 |
| 15 | Immunomodulators | 536–541 | 86 | 46 | 4 |

Across the 15 pharmacology chapters: **2,575 cards** and **1,589 leaf topics**,
with **101 cropped figure attachments**.

#### Chapters 1–18 (biochemistry) — `Self_Assessment_and_Review_of_BIOCHEMISTRY.pdf`

These restart numbering at 1–18 with IDs `bi01`–`bi18`, in their own
**Biochemistry** sidebar group (via `subject: "Biochemistry"`), sorted by number.
Theory only — each chapter ends at its `REVIEW QUESTIONS` marker; the chapter
review MCQs, their explanations and the back-of-book Image-Based Questions section
are excluded. Key tables, classifications, pathways and figures are cropped into
cards. Every row is **100% outline coverage, 0 errors, 0 warnings**.

| Ch | Title | PDF pages | Cards | Topics | Figures used |
|----|-------|-----------|-------|--------|--------------|
| 1 | Chemistry and Metabolism of Amino Acids | 20–53 | 290 | 136 | 59 |
| 2 | Proteins | 73–103 | 162 | 146 | 90 |
| 3 | Enzymes | 117–126 | 201 | 114 | 33 |
| 4 | Chemistry of Carbohydrates | 136–147 | 226 | 118 | 55 |
| 5 | Metabolism of Carbohydrates | 154–177 | 192 | 143 | 79 |
| 6 | Chemistry of Lipids and Biomembranes | 196–209 | 215 | 143 | 14 |
| 7 | Metabolism of Lipids | 216–241 | 213 | 150 | 45 |
| 8 | Chemistry and Metabolism of Nucleotides | 258–265 | 258 | 145 | 28 |
| 9 | Structure and Organization of DNA | 269–273 | 119 | 58 | 13 |
| 10 | DNA Replication | 279–282 | 120 | 58 | 12 |
| 11 | Transcription | 288–296 | 110 | 100 | 30 |
| 12 | Translation | 303–306 | 107 | 69 | 11 |
| 13 | Regulation of Gene Expression | 313–322 | 222 | 109 | 33 |
| 14 | Molecular Biology Techniques and Recent advances in Molecular Biology | 332–352 | 246 | 106 | 80 |
| 15 | Vitamins and Minerals | 368–389 | 141 | 128 | 73 |
| 16 | Heme Metabolism and Hemoglobins | 399–412 | 189 | 109 | 57 |
| 17 | TCA Cycle and Biological Oxidation | 416–423 | 102 | 79 | 28 |
| 18 | Free Radicals, Xenobiotics and Metabolism of Alcohol | 428–431 | 124 | 78 | 34 |

Across the 18 biochemistry chapters: **3,237 cards** and **1,989 leaf topics**,
with **774 cropped figure attachments**.

#### Chapters 1–63 (forensic medicine) — `forensic.pdf`

These keep the book's original chapter numbers 1–63 with **chapter 2 omitted**, so
there are 62 chapters with IDs `fm01`, `fm03` … `fm63`. They sit in their own
**Forensic Medicine** sidebar group (via `subject: "Forensic Medicine"`), sorted by
book number. Theory only — each chapter stops at its `Multiple Choice Questions`
heading; the MCQ banks and the back-of-book Question Bank-I / Question Bank-II are
excluded. In-chapter `Medico-legal Questions` teaching prose is retained as teaching
cards. **No images were cropped or attached for this subject.** Every row is
**100% outline coverage, 0 errors, 0 warnings**.

| Ch | Title | PDF pages | Cards | Topics | Figures used |
|----|-------|-----------|-------|--------|--------------|
| 1 | Medical Jurisprudence and Ethics | 28–51 | 216 | 104 | 0 |
| 3 | Legal Procedure | 68–77 | 119 | 78 | 0 |
| 4 | Identification I | 81–104 | 183 | 112 | 0 |
| 5 | Identification II | 109–113 | 64 | 56 | 0 |
| 6 | Medico-legal Autopsy | 123–141 | 146 | 145 | 0 |
| 7 | Autopsy Room Hazards | 147–149 | 47 | 43 | 0 |
| 8 | Thanatology | 151–158 | 75 | 73 | 0 |
| 9 | Signs of Death | 161–181 | 140 | 136 | 0 |
| 10 | Asphyxia | 185–190 | 78 | 34 | 0 |
| 11 | Injuries | 213–230 | 177 | 84 | 0 |
| 12 | Firearm Injuries | 234–249 | 173 | 84 | 0 |
| 13 | Regional Injuries | 257–283 | 149 | 146 | 0 |
| 14 | Thermal Injuries | 288–296 | 56 | 54 | 0 |
| 15 | Transportation Injuries | 306–312 | 57 | 47 | 0 |
| 16 | Explosion Injuries and Fall from Height | 314–318 | 48 | 38 | 0 |
| 17 | Medico-legal Aspects of Injuries | 320–326 | 55 | 54 | 0 |
| 18 | Decompression, Radiation and Altitude Sickness | 335–336 | 29 | 20 | 0 |
| 19 | Starvation Deaths | 338–339 | 32 | 20 | 0 |
| 20 | Anesthetic Deaths | 341–344 | 32 | 29 | 0 |
| 21 | Infanticide and Child Abuse | 345–359 | 71 | 67 | 0 |
| 22 | Abortion | 362–368 | 49 | 47 | 0 |
| 23 | Impotence and Sterility | 370–376 | 59 | 57 | 0 |
| 24 | Virginity, Pregnancy and Delivery | 378–388 | 84 | 83 | 0 |
| 25 | Sexual Offences I | 391–406 | 107 | 104 | 0 |
| 26 | Sexual Offences II | 413–416 | 37 | 35 | 0 |
| 27 | Sexual Offences III | 419–421 | 49 | 45 | 0 |
| 28 | Postmortem Artifacts | 424–426 | 23 | 21 | 0 |
| 29 | Forensic Psychiatry | 428–441 | 139 | 136 | 0 |
| 30 | Bloodstain Analysis | 447–453 | 63 | 62 | 0 |
| 31 | Seminal Stains and Other Biological Fluids | 456–460 | 52 | 50 | 0 |
| 32 | DNA Fingerprinting | 463–468 | 46 | 44 | 0 |
| 33 | Torture and Custodial Deaths | 471–474 | 51 | 48 | 0 |
| 34 | Medico-legal Aspects of HIV | 476–477 | 26 | 24 | 0 |
| 35 | Newer Techniques and Recent Advances | 479–480 | 19 | 17 | 0 |
| 36 | General Toxicology | 489–503 | 132 | 129 | 0 |
| 37 | Corrosive Poisons | 506–511 | 64 | 46 | 0 |
| 38 | Inorganic Metallic Irritants—Arsenic | 513–516 | 43 | 42 | 0 |
| 39 | Inorganic Metallic Irritants—Mercury | 518–521 | 38 | 37 | 0 |
| 40 | Inorganic Metallic Irritants—Lead | 523–527 | 45 | 43 | 0 |
| 41 | Inorganic Metallic Irritants—Copper | 529–530 | 18 | 17 | 0 |
| 42 | Inorganic Metallic Irritants—Thallium | 532–533 | 21 | 20 | 0 |
| 43 | Other Inorganic Metallic Irritants | 534–536 | 29 | 28 | 0 |
| 44 | Non-Metallic and Mechanical Irritants | 538–539 | 19 | 18 | 0 |
| 45 | Organic Irritants—Plant | 541–546 | 62 | 55 | 0 |
| 46 | Organic Irritants—Animal | 548–558 | 82 | 81 | 0 |
| 47 | Somniferous Poisons (Narcotic Poisons) | 561–564 | 38 | 36 | 0 |
| 48 | Inebriants—Alcohol | 566–580 | 100 | 97 | 0 |
| 49 | Sedative-hypnotic—Barbiturates | 583–584 | 49 | 39 | 0 |
| 50 | Deliriants—Dhatura/Datura | 586–588 | 68 | 63 | 0 |
| 51 | Deliriants—Cannabis | 590–591 | 52 | 49 | 0 |
| 52 | Deliriants—Cocaine | 593–594 | 57 | 55 | 0 |
| 53 | Spinal and Peripheral Nerve Poisons | 596–598 | 66 | 28 | 0 |
| 54 | Cardiac Poisons | 600–604 | 100 | 58 | 0 |
| 55 | Hydrocyanic Acid | 606–608 | 37 | 24 | 0 |
| 56 | Asphyxiants | 610–613 | 43 | 32 | 0 |
| 57 | War Gases and Biological Weapons | 615–617 | 30 | 21 | 0 |
| 58 | Agricultural Poisons | 619–627 | 101 | 54 | 0 |
| 59 | Alphos (Aluminum Phosphide) | 630–633 | 74 | 37 | 0 |
| 60 | Medicinal Poisons | 635–640 | 84 | 67 | 0 |
| 61 | Drug Dependence and Date Rape Drugs | 642–648 | 83 | 61 | 0 |
| 62 | Kerosene Oil Poisoning | 651–651 | 18 | 13 | 0 |
| 63 | Food Poisoning | 653–656 | 51 | 43 | 0 |

Across the 62 forensic medicine chapters: **4,355 cards** and **3,490 leaf
topics**, with **0 cropped figure attachments**.

#### Chapters 1–19 (pathology and genetics) — `Review Of Pathology And Genetics 10th.pdf`

These keep the book's original chapter numbers 1–19 with IDs `pg01`–`pg19`, in
their own **Pathology and Genetics** sidebar group (via
`subject: "Pathology and Genetics"`), sorted by number. Theory only — each chapter
stops at its `Multiple Choice Questions` heading; the MCQ banks and their
Explanations are excluded. Tables and figures are taught as text cards;
**no images were cropped or attached for this subject**. Every row is **100%
outline coverage, 0 errors, 0 warnings**.

| Ch | Title | PDF pages | Cards | Topics | Figures used |
|----|-------|-----------|-------|--------|--------------|
| 1 | Cell Injury | 9–18 | 122 | 96 | 0 |
| 2 | Inflammation | 31–45 | 224 | 112 | 0 |
| 3 | Hemodynamics | 61–68 | 175 | 89 | 0 |
| 4 | Genetics | 77–94 | 338 | 169 | 0 |
| 5 | Neoplasia | 112–130 | 144 | 133 | 0 |
| 6 | Immunity | 153–175 | 183 | 178 | 0 |
| 7 | Anemia and Red Blood Cells | 203–222 | 382 | 168 | 0 |
| 8 | White Blood Cells | 246–264 | 349 | 173 | 0 |
| 9 | Platelets and Blood Transfusion | 289–299 | 148 | 74 | 0 |
| 10 | Cardiovascular System | 313–329 | 206 | 112 | 0 |
| 11 | Respiratory System | 347–361 | 283 | 142 | 0 |
| 12 | Kidney and Urinary Bladder | 378–393 | 234 | 150 | 0 |
| 13 | Gastrointestinal Tract | 419–432 | 163 | 150 | 0 |
| 14 | Liver | 450–460 | 127 | 121 | 0 |
| 15 | Genital System and Breast | 478–498 | 246 | 119 | 0 |
| 16 | Central Nervous System | 510–520 | 230 | 113 | 0 |
| 17 | Endocrine System | 532–547 | 268 | 153 | 0 |
| 18 | Musculoskeletal System | 562–567 | 134 | 62 | 0 |
| 19 | Miscellaneous | 576–578 | 84 | 40 | 0 |

Across the 19 pathology and genetics chapters: **4,040 cards** and **2,354 leaf
topics**, with **0 cropped figure attachments**.

#### Chapters 2–21 (orthopedics) — `orthoped.docx`

These keep the document's original chapter numbers 2–21 with IDs `ortho02`–`ortho21`,
in their own **Orthopedics** sidebar group (via `subject: "Orthopedics"`), sorted by
number. Chapter 1 has no `COMPLETE CHAPTER SUMMARY` section in the source, so it has
no chapter here. Only the **COMPLETE CHAPTER SUMMARY** sections were used — the MCQ
bank, answer/explanation text, `PDF Reference` lines and `STUDENTS DOUBTS` blocks are
excluded. Tables are taught as text cards; **no images were cropped or attached for
this subject**. Every row is **100% outline coverage, 0 errors, 0 warnings**.

| Ch | Title | Cards | Topics | Figures used |
|----|-------|-------|--------|--------------|
| 2 | Infection of Bone and Joints | 102 | 64 | 0 |
| 3 | Tuberculosis of Bone and Joints | 73 | 67 | 0 |
| 4 | Orthopedics Oncology | 124 | 91 | 0 |
| 5 | Fracture and Fracture Healing | 121 | 87 | 0 |
| 6 | Advanced Trauma Life Support | 36 | 31 | 0 |
| 7 | Upper Limb Traumatology | 134 | 121 | 0 |
| 8 | Spinal Injury | 57 | 53 | 0 |
| 9 | Pelvis and Hip Injury | 133 | 94 | 0 |
| 10 | Lower Limb Traumatology | 79 | 65 | 0 |
| 11 | Fracture Management | 88 | 52 | 0 |
| 12 | Amputations | 56 | 37 | 0 |
| 13 | Sports Injury | 99 | 90 | 0 |
| 14 | Neuromuscular Disease | 132 | 119 | 0 |
| 15 | Peripheral Nerve Injury | 138 | 128 | 0 |
| 16 | Joint Disorders | 232 | 225 | 0 |
| 17 | Metabolic Disorders of Bone | 175 | 131 | 0 |
| 18 | Pediatric Orthopedics | 166 | 136 | 0 |
| 19 | Osteochondritis and Avascular Necrosis | 73 | 65 | 0 |
| 20 | DNB Questions | 82 | 76 | 0 |
| 21 | Complete Summary of Orthopedics | 406 | 245 | 0 |

Across the 20 orthopedics chapters: **2,506 cards** and **1,977 leaf topics**, with
**0 cropped figure attachments**.

#### Chapters 1–30 (ENT) — `ENT Sakshi arora E7.pdf`

These keep the book's chapter numbers with IDs `ent01`–`ent19`, `ent20a`/`ent20b`
and `ent21`–`ent30`, in their own **ENT** sidebar group (via `subject: "ENT"`),
sorted by number. Chapter 20 has two source chapters, 20A and 20B; both use
`number: 20`, and the app preserves their source order (20A before 20B). Theory
is taken from each chapter's teaching pages; the MCQ banks, answer/explanation
blocks, embedded "New Pattern Questions" and the book's Recent Papers section are
excluded. Figures, flowcharts and tables are taught as text cards; **no images
were cropped or attached for this subject**, and there is no `==...==`
highlighting. Every row is **100% outline coverage, 0 errors, 0 warnings**.

| Ch | Title | Cards | Topics | Figures used |
|----|-------|-------|--------|--------------|
| 01 | Anatomy of Ear | 214 | 107 | 0 |
| 02 | Physiology of Ear and Hearing | 66 | 34 | 0 |
| 03 | Hearing Loss | 65 | 31 | 0 |
| 04 | Assessment of Hearing Loss | 162 | 81 | 0 |
| 05 | Assessment of Vestibular Function | 58 | 34 | 0 |
| 06 | Diseases of External Ear | 81 | 62 | 0 |
| 07 | Diseases of Middle Ear | 119 | 115 | 0 |
| 08 | Meniere’s Disease | 121 | 54 | 0 |
| 09 | Otosclerosis | 70 | 34 | 0 |
| 10 | Facial Nerve and its Lesions | 88 | 80 | 0 |
| 11 | Lesion of Cerebellopontine Angle and Acoustic Neuroma | 87 | 38 | 0 |
| 12 | Glomus Tumor and Other Tumors of the Ear | 100 | 50 | 0 |
| 13 | Rehabilitative Methods | 61 | 45 | 0 |
| 14 | Miscellaneous | 18 | 9 | 0 |
| 15 | Anatomy and Physiology of Nose | 128 | 56 | 0 |
| 16 | Diseases of External Nose and Nasal Septum | 115 | 56 | 0 |
| 17 | Granulomatous Disorders of Nose, Nasal Polyps and Foreign Body in Nose | 92 | 66 | 0 |
| 18 | Inflammatory Disorders of Nasal Cavity | 70 | 47 | 0 |
| 19 | Epistaxis | 118 | 58 | 0 |
| 20A | Diseases of Paranasal Sinus—Sinusitis | 171 | 89 | 0 |
| 20B | Diseases of Paranasal Sinus—Sinonasal Tumor | 128 | 64 | 0 |
| 21 | Oral Cavity | 228 | 113 | 0 |
| 22 | Anatomy of Pharynx, Tonsils and Adenoids | 151 | 89 | 0 |
| 23 | Head and Neck Space Inflammation and Thornwaldt’s Bursitis | 126 | 63 | 0 |
| 24 | Lesions of Nasopharynx and Hypopharynx including Tumors of Pharynx | 155 | 93 | 0 |
| 25 | Pharynx Hot Topics | 120 | 60 | 0 |
| 26 | Anatomy of Larynx, Congenital Lesions of Larynx and Stridor | 88 | 72 | 0 |
| 27 | Acute and Chronic Inflammation of Larynx, Voice and Speech Disorders | 117 | 75 | 0 |
| 28 | Vocal Cord Paralysis | 94 | 66 | 0 |
| 29 | Tumors of Larynx | 83 | 44 | 0 |
| 30 | Important Operative Procedures | 94 | 49 | 0 |

Across the 31 ENT chapters: **3,388 cards** and **1,934 leaf topics**, with
**0 cropped figure attachments**.

#### Chapters 1–13 (Psychiatry) — `pdfcoffee.com_review-of-psychiatry-praveen-tripathi-1st-ed-2016-pdf-free.pdf`

These keep the book's chapter numbers 1–13 with IDs `psy01`–`psy13`, in their own
**Psychiatry** sidebar group (via `subject: "Psychiatry"`), sorted by number. Theory
only — each chapter stops before its `QUESTIONS` section; question banks, answer
keys, explanations and exam tags are excluded. Figures, flowcharts and tables are
taught as text cards; **no images were cropped or attached for this subject**, and
there is no `==...==` highlighting. Every row shows **100% outline coverage, 0
errors, 0 warnings**.

| Ch | Title | Cards | Topics | Figures used |
|----|-------|-------|--------|--------------|
| 01 | Basics | 81 | 47 | 0 |
| 02 | Schizophrenia Spectrum and Other Psychotic Disorders | 164 | 77 | 0 |
| 03 | Mood Disorders | 142 | 69 | 0 |
| 04 | Neurotic, Stress Related and Somatoform Disorders | 189 | 88 | 0 |
| 05 | Substance Related and Addictive Disorders | 196 | 98 | 0 |
| 06 | Organic Mental Disorders | 92 | 63 | 0 |
| 07 | Personality Disorders | 43 | 24 | 0 |
| 08 | Eating Disorders | 33 | 16 | 0 |
| 09 | Sleep Disorders | 79 | 36 | 0 |
| 10 | Sexual Disorders | 67 | 26 | 0 |
| 11 | Child Psychiatry | 76 | 34 | 0 |
| 12 | Psychoanalysis | 91 | 46 | 0 |
| 13 | Miscellaneous | 109 | 77 | 0 |

Across the 13 psychiatry chapters: **1,362 cards** and **701 leaf topics**, with
**0 cropped figure attachments**.

#### Chapters 1–12 (Opthalmology) — `pdfcoffee.com_self-assessment-and-review-of-ophthalmology-pdf-free.pdf`

These keep the book's chapter numbers 1–12 with IDs `oph01`–`oph12`, in their own
**Opthalmology** sidebar group (via `subject: "Opthalmology"`, the user-specified
spelling), sorted by number. Theory only — each chapter stops before its question
bank; MCQs, answer/explanation blocks, exam tags and the Image-based Questions
section are excluded. Figures, plates and tables are taught as text cards; **no
images were cropped or attached for this subject**, and there is no `==...==`
highlighting. Every row shows **100% outline coverage, 0 errors, 0 warnings**.

| Ch | Title | Cards | Topics | Figures used |
|----|-------|-------|--------|--------------|
| 01 | Ocular Embryology | 39 | 17 | 0 |
| 02 | Conjunctiva, Sclera and Cornea | 165 | 78 | 0 |
| 03 | Glaucoma | 81 | 65 | 0 |
| 04 | Lens | 140 | 78 | 0 |
| 05 | Retina | 214 | 91 | 0 |
| 06 | Uveal Tract | 127 | 60 | 0 |
| 07 | Ocular Adnexa | 134 | 99 | 0 |
| 08 | Optics and Refraction | 82 | 44 | 0 |
| 09 | Strabismus | 114 | 53 | 0 |
| 10 | Neuro-ophthalmology | 127 | 91 | 0 |
| 11 | Ocular Manifestations of Systemic Diseases | 22 | 9 | 0 |
| 12 | Miscellaneous Topics | 31 | 11 | 0 |

Across the 12 opthalmology chapters: **1,276 cards** and **696 leaf topics**, with
**0 cropped figure attachments**.

#### Annexures + Chapters 1–19 (Physiology) — `2 Physio manna E2.pdf`

These keep the book's structure with IDs `phys00`–`phys19`: `phys00` is the
book's **Annexures** (glucose transporters, aquaporins and regional circulation
tables) and `phys01`–`phys19` are chapters 1–19, in their own **Physiology**
sidebar group. Theory only — each chapter stops before its question bank;
`RECENT MCQs`, `AIIMS/PGI/JIPMER`, `FUTURE TRENDS`, answer/explanation blocks,
exam tags and embedded in-chapter MCQ boxes are excluded. Figures, flowcharts and
tables are taught as text cards; **no images were cropped or attached for this
subject**, and there is no `==...==` highlighting. Every row shows **100% outline
coverage, 0 errors, 0 warnings**.

| Ch | Title | Cards | Topics | Figures used |
|----|-------|-------|--------|--------------|
| 00 | Annexures | 134 | 67 | 0 |
| 01 | Body Fluid: Distribution and Measurement | 153 | 69 | 0 |
| 02 | Cell Membrane, Transport and Membrane Potential | 185 | 84 | 0 |
| 03 | Physiology of Nerve | 160 | 86 | 0 |
| 04 | Physiology of Muscle | 137 | 105 | 0 |
| 05 | Electrophysiology of Heart | 193 | 71 | 0 |
| 06 | Cardiac Output and Regulation | 108 | 65 | 0 |
| 07 | Blood Pressure and Regulation | 236 | 92 | 0 |
| 08 | Vascular System and Regional Circulation | 167 | 71 | 0 |
| 09 | Mechanics of Respiration with Lung Volumes and Capacities | 206 | 100 | 0 |
| 10 | Gaseous Exchange | 131 | 62 | 0 |
| 11 | Regulation of Respiration and Applied Physiology | 90 | 67 | 0 |
| 12 | Sensory Physiology | 240 | 110 | 0 |
| 13 | Motor Physiology | 142 | 114 | 0 |
| 14 | Higher Functions and Special Senses | 124 | 80 | 0 |
| 15 | Renal Physiology | 175 | 153 | 0 |
| 16 | Gastrointestinal Physiology | 133 | 112 | 0 |
| 17 | Endocrine Physiology | 275 | 105 | 0 |
| 18 | Male and Female Reproductive Physiology | 146 | 80 | 0 |
| 19 | Special Topic Exercise Physiology | 75 | 56 | 0 |

Across the 20 physiology chapters: **3,210 cards** and **1,749 leaf topics**, with
**0 cropped figure attachments**.

#### Few Thumb Rules + Chapters 1–7 (Radiology) — `Review_of_Radiology.pdf`

These keep the book's structure with IDs `rad00`–`rad07`: `rad00` is the book's
**Few Thumb Rules in Radiology** section and `rad01`–`rad07` are chapters 1–7, in
their own **Radiology** sidebar group (via `subject: "Radiology"`). Theory only —
each numbered chapter stops before its `QUESTIONS` section; the question banks,
answer keys, `MULTIPLE CORRECT ANSWERS` blocks and the book's **Image Based
Questions** section are excluded. Unlike the text-only recent subjects, key
radiographs and scans are cropped from the PDF and attached to `figure` cards;
there is no `==...==` highlighting. Every row shows **100% outline coverage, 0
errors, 0 warnings**.

| Ch | Title | PDF pages | Cards | Topics | Figures used |
|----|-------|-----------|-------|--------|--------------|
| 0 | Few Thumb Rules in Radiology | 266–274 | 113 | 37 | 0 |
| 1 | General Radiology | 16–42 | 266 | 131 | 27 |
| 2 | Neuroradiology | 58–74 | 275 | 134 | 20 |
| 3 | Cardiothoracic Radiology | 88–123 | 337 | 190 | 37 |
| 4 | Gastrointestinal and Genitourinary System | 137–164 | 207 | 154 | 45 |
| 5 | Musculoskeletal Radiology | 183–214 | 416 | 207 | 34 |
| 6 | Radiotherapy and Chemotherapy | 226–235 | 148 | 74 | 0 |
| 7 | Nuclear Scans | 249–258 | 196 | 96 | 0 |

Across the 8 radiology chapters: **1,958 cards** and **1,023 leaf topics**, with
**165 cropped figure attachments** (163 distinct radiographs, each attached to at
least one `figure` card). The book's **Image Based Questions** section is excluded.

#### Important Topics, Annexures + Chapters 1–15 (Gynecology) — `dokumen.pub_self-assessment-amp-review-gynecology-12nbsped.pdf`

These keep the book's structure with IDs `gy00`–`gy19`: `gy00` is the book's
**Important Topics: Vulvar Cancer & Cancer of the Cervix Uteri** section, `gy01` is the
**Annexures**, `gy02`–`gy14` are chapters 1–13, `gy15`–`gy18` are chapter 14A–14D (all
numbered 14), and `gy19` is chapter 15. They sit in their own **Gynecology** sidebar
group (via `subject: "Gynecology"`). Theory only — each chapter stops before its
question bank; `NEW PATTERN QUESTIONS`, `PREVIOUS YEAR QUESTIONS`, the **AIIMS New
Pattern Questions with Answers** section and **Latest Papers** are excluded. Chapter
15 has no theory section, so its cards were built only from the substantive teaching
prose in the answer explanations; MCQ stems, options, answer letters and references
were excluded. Figures, plates, USGs, HSGs and instruments are taught as text cards;
**no images were cropped or attached for this subject**, and there is no `==...==`
highlighting. Every row shows **100% outline coverage, 0 errors, 0 warnings**.

| Ch | Title | Cards | Topics | Figures used |
|----|-------|-------|--------|--------------|
| 0 | Important Topics: Vulvar Cancer & Cancer of the Cervix Uteri | 114 | 83 | 0 |
| 0 | Annexures | 161 | 79 | 0 |
| 1 | Anatomy of the Female Genital Tract | 312 | 178 | 0 |
| 2 | Reproductive Physiology and Hormones in Females | 297 | 152 | 0 |
| 3 | Menopause and HRT | 183 | 115 | 0 |
| 4 | PCOD, Hirsutism and Galactorrhea | 161 | 119 | 0 |
| 5 | Congenital Malformations (Important for Images-based Questions) | 193 | 96 | 0 |
| 6 | Sexuality and Intersexuality | 165 | 87 | 0 |
| 7 | Infections of the Genital Tract | 152 | 95 | 0 |
| 8 | Urogynecology | 162 | 130 | 0 |
| 9 | Infertility | 146 | 123 | 0 |
| 10 | Contraception | 227 | 217 | 0 |
| 11 | Uterine Fibroid | 150 | 80 | 0 |
| 12 | Endometriosis and Dysmenorrhea | 115 | 92 | 0 |
| 13 | Disorders of Menstruation | 143 | 128 | 0 |
| 14 | Gynecological Oncology: Uterine Cancer | 187 | 92 | 0 |
| 14 | Gynecological Oncology: CIN, Cancer Cervix | 276 | 136 | 0 |
| 14 | Gynecological Oncology: Ovarian Tumors | 155 | 126 | 0 |
| 14 | Gynecological Oncology: Miscellaneous Tumors | 129 | 58 | 0 |
| 15 | Gynecological Diagnosis and Operative Surgery | 122 | 59 | 0 |

Across the 20 gynecology chapters: **3,550 cards** and **2,245 leaf topics**, with
**0 cropped figure attachments**.

#### Chapters 1–28 + Latest Papers (OBS) — `sel&ass&rev&obs&12th.pdf`

These keep the book's chapter numbering with IDs `obs01`–`obs28`; `obs29` is the
book's unnumbered **Latest Papers** section, numbered 29 only so it sorts last. They
sit in their own **OBS** sidebar group (via `subject: "OBS"`). At the user's request,
**all sections are included**: theory, in-chapter New Pattern and Previous Year
questions, answers/explanations, options, `Ans.`, `Ref.`, exam tags and Latest Papers.
Figures, plates, scans and instruments are taught as text cards; **no images were
cropped or attached for this subject**, and there is no `==...==` highlighting. Every
row shows **100% outline coverage, 0 errors, 0 warnings**.

| Ch | Title | Cards | Topics | Figures used |
|----|-------|-------|--------|--------------|
| 1 | Basics of Reproduction | 124 | 96 | 0 |
| 2 | Placenta, Fetal Membranes and Umbilical Cord | 144 | 90 | 0 |
| 3 | Amniotic Fluid and its Abnormalities | 114 | 84 | 0 |
| 4 | Fetal Physiology | 88 | 68 | 0 |
| 5 | Maternal Adaptations in Pregnancy | 236 | 199 | 0 |
| 6 | Diagnosis in Obstetrics and Fetal Monitoring | 235 | 230 | 0 |
| 7 | Pelvis and Fetal Skull | 177 | 122 | 0 |
| 8 | Fetus in Utero | 54 | 41 | 0 |
| 9 | Normal and Abnormal Labor | 149 | 132 | 0 |
| 10 | Third Stage of Labor and its Complications | 144 | 117 | 0 |
| 11 | Malpresentations | 212 | 175 | 0 |
| 12 | Obstructed Labor and Intrauterine Death (IUD) | 115 | 96 | 0 |
| 13 | Operative Obstetrics | 115 | 112 | 0 |
| 14 | Preterm Labor, Premature Rupture of Membranes and Post-dated Pregnancy | 129 | 124 | 0 |
| 15 | Abortion and MTP | 143 | 134 | 0 |
| 16 | Ectopic Pregnancy | 101 | 97 | 0 |
| 17 | Trophoblastic Diseases including Choriocarcinoma | 167 | 143 | 0 |
| 18 | Antepartum Hemorrhage (APH) and DIC | 149 | 141 | 0 |
| 19 | Multifetal Pregnancy | 118 | 86 | 0 |
| 20 | Pregnancy in Rh-Negative Women | 123 | 95 | 0 |
| 21 | Anemia in Pregnancy | 129 | 84 | 0 |
| 22 | Heart Disease in Pregnancy | 125 | 110 | 0 |
| 23 | Diabetes and Thyroid in Pregnancy | 258 | 183 | 0 |
| 24 | Hypertensive Disorders in Pregnancy | 125 | 122 | 0 |
| 25 | Infections in Pregnancy | 131 | 128 | 0 |
| 26 | Other Problems in Pregnancy | 171 | 165 | 0 |
| 27 | Puerperium and its Abnormalities | 117 | 115 | 0 |
| 28 | Fetal Growth Disorders | 114 | 101 | 0 |
| 29 | Latest Papers | 80 | 69 | 0 |

Across the 29 OBS chapters: **4,087 cards** and **3,459 leaf topics**, with
**0 cropped figure attachments**.

### USMLE — First Aid Step 1 2025, Biochemistry

| # | Chapter | PDF pages | Cards | Leaf topics | Figure attachments |
| --- | --- | --- | ---: | ---: | ---: |
| 1 | Molecular Biology | 52–64 | 102 | 67 | 13 |
| 2 | Cellular Biology | 65–70 | 53 | 36 | 6 |
| 3 | Laboratory Techniques | 71–74 | 30 | 22 | 4 |
| 4 | Genetics | 75–83 | 86 | 59 | 9 |
| 5 | Nutrition | 84–91 | 54 | 34 | 8 |
| 6 | Metabolism | 92–113 | 185 | 127 | 22 |

Across the 6 USMLE chapters: **510 cards**, **345 leaf topics**, **62 unique
full-page plates** and **390 figure attachments**. Source bold text is preserved as
purple `**...**` emphasis; no amber `==...==` Q markers are used.

### Medicine

The **Medicine** group (via `subject: "Medicine"`) comes from
`medicine1_part_1.pdf` — *Self Assessment & Review: Medicine*, 9/e, Mudit Khanna.
Theory only: every chapter uses the Essential Revision Notes and stops before its
question bank and answer/explanation section. **No images were cropped or attached
for this subject**, and no amber `==...==` Q markers are used. Every row shows
**100% outline coverage, 0 errors**.

| # | Chapter | PDF pages | Cards | Leaf topics | Figure attachments |
|---|---------|-----------|-------|-------------|--------------------|
| 1 | Red Cell Indices and Anemia Classification | 20–22 | 58 | 31 | 0 |
| 2 | Hemolytic Anemias and Hemoglobinopathies | 23–29 | 80 | 41 | 0 |
| 3 | Bone Marrow Failure, PNH and Myeloproliferative Disorders | 30–35 | 69 | 31 | 0 |
| 4 | Lymphomas and Chronic Leukemias | 36–44 | 90 | 35 | 0 |
| 5 | Acute Leukemias and Plasma Cell Disorders | 45–48 | 65 | 39 | 0 |
| 6 | Coagulation, Bleeding and Transfusion | 49–59 | 84 | 43 | 0 |
| 7 | Cardiovascular Examination: Pulses, JVP and Heart Sounds | 250–258 | 50 | 38 | 0 |
| 8 | ECG, Arrhythmias and Valvular Disease | 259–267 | 49 | 34 | 0 |

Across the 8 Medicine chapters: **545 cards** and **292 leaf topics**, all text-only.

**Combined total across all sixteen subjects: 343 chapters, 47,841 cards, 31,231 leaf
topics, 2,324 cropped figure attachments, and 12,090 amber `Q` highlights
(surgery only).**

Run the check yourself:

```powershell
cd C:\Users\pc\chapter-cards
node tools/validate.js
```

Exit code is non-zero if any coverage error exists.

## The completeness contract

"Nothing left out" is enforced mechanically, not by eyeballing:

1. A chapter declares an `outline` tree. **Every leaf node is a required topic.**
2. Every card declares `topics: [leafId, ...]` linking it to one or more leaves.
3. `js/validator.js` fails the chapter if any leaf has zero cards, or if there are
   structural problems (duplicate IDs, empty cards, unknown topic IDs, etc.).

Warnings are advisory. `THIN_TOPIC` means a leaf has a single recall-type card and
could use a deeper card later. `NO_EXAMPLE_CARDS` is suppressed for chapters that set
`excludeExamples: true`, because clinical vignettes are intentionally out of scope
here (they are the question bank).

## Data schema

Edit `js/data.js`. It exports `CHAPTERS`, an array of chapter objects:

```js
{
  id: "ch02",
  number: 2,
  title: "Thyroid",
  status: "draft",
  subject: "Surgery",             // optional: sidebar group (defaults to "Surgery");
                                  // anatomy/pharmacology/biochemistry/forensic/pathology/ortho/ENT/psychiatry/opthalmology/physiology/radiology/gynecology/obs chapters set their own subject
  excludeExamples: true,          // optional: suppress example-card warning
  source: {
    file: "surgeryrev_part_1.pdf — Surgery Essence 8/e",
    pageRange: "PDF 149–... (book pp. 49–...) — narrative text only; MCQ bank excluded"
  },
  outline: [                       // heading tree; leaves are the coverage units
    { id: "2.1", title: "Anatomy", page: 149, children: [
      { id: "2.1.1", title: "...", page: 149 }
    ]}
  ],
  cards: [
    {
      id: "ch02-c001",             // unique across the chapter
      type: "concept",             // concept | definition | example | summary |
                                   // process | compare | figure | clinical | fact
      topics: ["2.1.1"],           // >= 1 existing LEAF id
      sourcePage: 149,             // PDF page
      front: "Question / prompt",
      back: "Answer / explanation",
      images: ["assets/images/an05_fig12.jpeg"] // optional cropped figures
    }
  ]
}
```

`\n` inside `back` creates line breaks. Card IDs need only be unique inside the
chapter; gaps in numbering are fine. The optional `images` array holds paths
(relative to `index.html`) to cropped PDF figures shown on the card back and in the
big card; use only files that exist under `assets/images/`.

## Adding another chapter

1. **Extract the narrative pages.** The PDF is too large for direct reading, so use
   PyMuPDF locally:

   ```powershell
   python C:\Users\pc\AppData\Local\Temp\opencode\dump_pdf_text.py `
     C:\Users\pc\Downloads\surgeryrev_part_1.pdf `
     C:\Users\pc\AppData\Local\Temp\opencode\ch02.txt 149 190
   ```

   Determine the end page from the table of contents (each chapter starts on the
   book page shown there). Stop **before** that chapter's MCQ bank begins.

2. **Build the outline skeleton** from the headings. Write them to a text file,
   indenting 2 spaces per level and appending `@pNN` for the PDF page
   (see `tools/headings.example.txt`):

   ```powershell
   node tools/scaffold-chapter.js "Thyroid" tools/headings.txt
   ```

   Paste the emitted object into `js/data.js`, set `id`, `number`, `source`, and
   `excludeExamples: true`.

3. **Write at least one card per leaf**, then run `node tools/validate.js` until the
   chapter reports 100% and 0 errors. Add deeper `concept` / `compare` / `process`
   cards for high-yield leaves to clear `THIN_TOPIC` warnings.

4. Refresh the browser. The new chapter appears in the sidebar automatically.

## Files

- `index.html` — app shell
- `css/styles.css` — layout, flip animation, report styling
- `js/data.js` — **all chapter content** (outline + cards)
- `js/validator.js` — shared coverage validator (browser + Node)
- `js/app.js` — rendering and interaction
- `tools/validate.js` — CLI coverage check
- `tools/scaffold-chapter.js` — heading-list → outline skeleton generator
- `tools/headings.example.txt` — example input for the scaffold tool
