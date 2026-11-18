# -*- coding: utf-8 -*-
"""
Build a static Loksewa Topic Analyzer & Predictor from the question banks
embedded in surgery-practice.html.

Scope: the 13 real Loksewa exam sets. The aggregated "Loksewa Live Mock Test"
is excluded because its questions are copied from those sets and would
double-count topics.

Output: loksewa-analysis.html — fully static, no CDN, no API, no model.
Only question *stems* (previews) are ever shown; answers/explanations are
used for keyword detection but are never displayed.
"""
from pathlib import Path
import html
import json
import re
from collections import Counter, defaultdict
from datetime import datetime

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "surgery-practice.html"
OUT = ROOT / "loksewa-analysis.html"


# ---------- parse the bank constants out of the large practice page ----------
def balanced(text, start):
    opener = text[start]
    closer = "}" if opener == "{" else "]"
    depth, i, quote, esc = 0, start, None, False
    while i < len(text):
        c = text[i]
        if quote:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == quote:
                quote = None
        else:
            if c in "\"'":
                quote = c
            elif c == opener:
                depth += 1
            elif c == closer:
                depth -= 1
                if depth == 0:
                    return i + 1
        i += 1
    raise ValueError("unbalanced JS literal")


def load_loksewa_sets():
    s = SRC.read_text(encoding="utf-8")
    objs = {}
    for m in re.finditer(r"\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*\{", s):
        try:
            objs[m.group(1)] = json.loads(s[m.end() - 1:balanced(s, m.end() - 1)])
        except Exception:
            pass
    entries = re.findall(
        r'\{\s*id:\s*"([^"]+)",\s*bank:\s*(\w+),\s*cat:\s*"([^"]+)"\s*\}', s)
    out = []
    for bid, var, cat in entries:
        if cat != "Loksewa" or bid == "loksewamock" or var not in objs:
            continue
        bank = objs[var]
        name = bank.get("name", bid)
        ym = re.search(r"(20\d\d)", name)
        out.append({
            "id": bid,
            "name": name,
            "year": int(ym.group(1)) if ym else 0,
            "questions": bank.get("questions", []),
        })
    out.sort(key=lambda x: (x["year"], x["name"]))
    return out


# ---------- topic taxonomy ----------
CHAPTER_MAP = [
    (r"obstetric|gynaec|gynec|\bobg\b", "Obstetrics & Gynaecology"),
    (r"community medicine|\bpsm\b|public health|preventive", "Community Medicine & Public Health"),
    (r"forensic", "Forensic Medicine"),
    (r"ophthalm", "Ophthalmology"),
    (r"\bent\b|ear,? nose", "ENT"),
    (r"orthop?aedic|orthoped", "Orthopaedics"),
    (r"anaesth|anesthes", "Anaesthesia"),
    (r"paediatr|pediatr", "Paediatrics"),
    (r"psychiatr", "Psychiatry"),
    (r"dermatol", "Dermatology"),
    (r"pharmacol", "Pharmacology"),
    (r"pathol", "Pathology"),
    (r"microbiol", "Microbiology"),
    (r"radiol", "Radiology"),
    (r"anatomy", "Anatomy"),
    (r"physiol", "Physiology"),
    (r"biochem", "Biochemistry"),
    (r"nursing", "Nursing"),
    (r"health policy", "Health Policy"),
    (r"\bmedicine\b|internal medicine", "Medicine"),
    (r"\bsurgery\b", "Surgery"),
]

# Fine-grained recurring concepts. (label, parent topic, regex)
CONCEPTS = [
    ("Meningitis", "Medicine", r"\bmeningit\w*"),
    ("Tuberculosis / TB", "Medicine", r"\btuberculos\w*|\bTB\b"),
    ("Malaria", "Medicine", r"\bmalaria\b"),
    ("COVID-19 / coronavirus", "Medicine", r"\bcovid|\bcorona\s?virus\b|\bsars-cov"),
    ("Diabetes / HbA1c", "Medicine", r"\bdiabet\w*|\bHbA1c\b|\bhyperglyc\w*"),
    ("Hypertension / BP", "Medicine", r"\bhypertens\w*|\bblood pressure\b"),
    ("Heart attack / ACS", "Medicine", r"\bmyocardial infarction\b|\bAMI\b|\bacute coronary\b|\bSTEMI\b"),
    ("Heart failure", "Medicine", r"\bheart failure\b|\bcardiac failure\b"),
    ("Anaemia", "Medicine", r"\ban[a]?emia\b|\banemic\b"),
    ("Sickle cell disease", "Medicine", r"\bsickle cell\b"),
    ("Thalassaemia", "Medicine", r"\bthalass\w*"),
    ("Leukaemia / lymphoma", "Medicine", r"\bleuk[a]?emia\b|\blymphoma\b"),
    ("Renal failure / AKI", "Medicine", r"\brenal failure\b|\bacute kidney injury\b|\bAKI\b"),
    ("Nephrotic syndrome", "Medicine", r"\bnephrotic\b"),
    ("Pneumonia", "Medicine", r"\bpneumonia\b"),
    ("Asthma / COPD", "Medicine", r"\basthma\b|\bCOPD\b|\bchronic obstructive\b"),
    ("Hepatitis / jaundice", "Medicine", r"\bhepatitis\b|\bjaundice\b|\bcirrhosis\b"),
    ("Peptic ulcer / gastritis", "Medicine", r"\bpeptic ulcer\b|\bgastritis\b"),
    ("HIV / AIDS", "Medicine", r"\bHIV\b|\bAIDS\b"),
    ("Thyroid / goitre", "Surgery", r"\bthyroid\b|\bgoitr[ei]\b"),
    ("Breast cancer", "Surgery", r"\bbreast (cancer|carcinoma|mass|tumou?r|lump)\b"),
    ("Appendicitis", "Surgery", r"\bappendicitis\b"),
    ("Hernia", "Surgery", r"\bhernia\b"),
    ("Burns", "Surgery", r"\bburns?\b"),
    ("Cataract", "Ophthalmology", r"\bcataract\b"),
    ("Glaucoma", "Ophthalmology", r"\bglaucoma\b"),
    ("Conjunctivitis / pink eye", "Ophthalmology", r"\bconjunctivit\w*|\bpink eye\b"),
    ("Horner syndrome", "Medicine", r"\bhorner\b"),
    ("Facial nerve palsy", "Medicine", r"\bfacial nerve\b|\bbell'?s palsy\b"),
    ("Stroke / hemiplegia", "Medicine", r"\bstroke\b|\bcerebrovascular\b|\bhemiplegia\b"),
    ("Epilepsy / seizures", "Medicine", r"\bepilep\w*|\bseizure\b"),
    ("Parkinsonism", "Medicine", r"\bparkinson\w*"),
    ("Psoriasis", "Dermatology", r"\bpsoriasis\b"),
    ("Vitiligo", "Dermatology", r"\bvitiligo\b"),
    ("Leprosy", "Dermatology", r"\bleprosy\b"),
    ("Fracture / trauma", "Orthopaedics", r"\bfracture\b|\btrauma\b"),
    ("Diarrhoea / ORS", "Community Medicine & Public Health", r"\bdiarrh\w*|\bORS\b"),
    ("Vaccination / immunization", "Community Medicine & Public Health", r"\bvaccin\w*|\bimmuni[sz]\w*"),
    ("Poliomyelitis", "Community Medicine & Public Health", r"\bpolio\w*"),
    ("Rabies", "Community Medicine & Public Health", r"\brabies\b"),
    ("Snake bite", "Community Medicine & Public Health", r"\bsnake bite\b"),
    ("Poisoning / toxicology", "Forensic Medicine", r"\bpoison\w*|\btoxicol\w*"),
    ("Age / sex from skeleton", "Forensic Medicine", r"\bossification\b|\bepiphyseal\b|\bskeleton\b"),
    ("Medical ethics / etiquette", "Forensic Medicine", r"\bmedical etiquette\b|\bmedical ethics\b|\binformed consent\b"),
    ("Nepal health policy / acts", "Health Policy", r"\bhealth policy\b|\bmedical council act\b|\bhealth service act\b|\bmuluki ain\b"),
    ("Pre-eclampsia / eclampsia", "Obstetrics & Gynaecology", r"\bpre[- ]?eclampsia\b|\beclampsia\b"),
    ("Postpartum haemorrhage", "Obstetrics & Gynaecology", r"\bpostpartum haemorrhage\b|\bPPH\b"),
]


# Broad topic keywords used when a paper gives only a generic chapter label
# (e.g. "Loksewa", "General Health Services", or a long combined label).
TOPIC_KEYWORDS = [
    ("Forensic Medicine", r"post[- ]?mortem|putrefa|autops|cadaver|spalding|rigor mortis|algor mortis|livor mortis|fingerprint|paternity|\brape\b|assault|poison\w*|forensic|medical council|medical etiquette|informed consent|malpractice|skeleton|ossification|epiphyseal|ante[- ]?mortem|death investigation|sudden death|medicolegal"),
    ("Community Medicine & Public Health", r"health education|health service|national health|new cases|incidence|prevalence|epidemiol|demograph|population|\bcensus\b|family planning|contracept|health programme|health policy|screening|sensitivity|specificity|water supply|sanitation|communicable|non[- ]communicable|sociolog|research method|hospital (use|utilization)|\bPEM\b|protein energy malnutrition|malnutrition|vaccin|immuni[sz]|birth rate|death rate|maternal mortality|child mortality|indicator"),
    ("Obstetrics & Gynaecology", r"pregnan|ectopic|abortion|gestation|cervical ripen|hydatidiform|\bH\.?mole\b|obstet|gynaec|gynec|labour|labor pain|delivery|placenta|pre[- ]?eclampsia|eclampsia|\bPPH\b|feto|foeto|fetal|foetal|amniotic|caesarean|cesarean|menstrua|menarche|ovarian|vagina|vulva|pelvic inflammatory|infertility|uterus|uterine|fallopian|ovulation"),
    ("Paediatrics", r"\bchild\b|children|infant|newborn|neonat|pediatr|paediatr|milk rejection|breast feed|developmental age|speaks \d|toy|school age|trisomy|congenital|years old boy|years old girl|year old child|childhood|\b5 year\b|\b2 year\b|birth weight|prematur"),
    ("Psychiatry", r"delusion|agoraphobia|alcohol withdrawal|\banxiety\b|depress\w*|psychos|schizophren|neurosi|psychiatr|mental (illness|health|state)|hallucinat|obsess\w*|phobia|suicid|personality disorder|sleep disorder|conversion disorder|hysteria"),
    ("Dermatology", r"\bacne\b|tinea|skin|dermat|psoriasis|vitiligo|eczema|leprosy|pruritus|hair follical|nail bed|ulcer.*skin|koebner|pemphigus"),
    ("Ophthalmology", r"corneal|conjunctiv|\beye\b|vision|visual|cataract|glaucoma|nasolacrimal|retina|pupil|lens|blindness|ophthalm|intraocular|eye ball|squint|ptosis"),
    ("ENT", r"\bear\b|hearing|tympanic|mastoid|vertigo|tonsil|sinusitis|laryng|pharyng|vocal cord|nasal|nose|throat|otitis|audiometr"),
    ("Anaesthesia", r"an[a]?esthes|anesthe|spinal anaesth|intubat|induction agent|\bIV anesthetic\b|propofol|ketamine|halothane|analgesia|opioid|kappa receptor|muscle relaxant|ventilat"),
    ("Pharmacology", r"\bdrug\b|\bdose\b|tablet|capsule|\bmg\b|antihistamine|\baspirin\b|antibiotic|plasma (drug|level)|side effect|receptor|antagonist|agonist|pharmacokinetic|therapeutic|contraindicat|drug of choice|adrenaline|atropine|morphine|penicillin"),
    ("Radiology", r"x[- ]?ray|\bCT\b|\bMRI\b|ultrasound|radiolog|contrast (media|agent)|scan|mammograph|barium|imaging"),
    ("Microbiology", r"bacteri|gram[ ']?s stain|virus|viral|fungal|fungus|organism|culture|\bE\.? ?coli\b|staphyl|strept|meningit|malaria|bronchiolitis|\bHIV\b|hepatitis|rabies|cholera|typhoid|parasite|protozo|helminth|infect\w*"),
    ("Pathology", r"tumou?r|cancer|carcinoma|sarcoma|benign|malignant|biopsy|histolog|necrosis|infarct|inflammat|leuk[a]?emia|lymphoma|\ban[a]?emia\b|thrombus|embolism|metasta|degeneration| amyloid|plasma cell|gram stain"),
    ("Biochemistry", r"vitamin|\benzyme\b|protein|glucose|metaboli|amino acid|lipid|\bDNA\b|\bRNA\b|HbA1c|biochem|bilirubin|cholesterol|trace element|mineral"),
    ("Physiology", r"temperature regulation|blood pressure|action potential|membrane potential|feedback|hormone|oxygen consumption|respiratory rate|ventilation|perfusion|physiol|renal threshold|electrolyte|acid[- ]base|\bpCO2\b|\bpH\b"),
    ("Anatomy", r"develops from|embryolog|ossification|\bbone\b|nerve supply|blood supply|muscle|anatom|branchial|pharyngeal arch|fetus|foetus|dermatome|vertebra|foramen|artery|vein"),
    ("Dentistry", r"dental|dentist|teeth|tooth|pulpitis|caries|gingiv|oral cavity|denture|enamel|dentin"),
    ("Surgery", r"fractur|traum|\bwound\b|hernia|appendic|gallbladder|cholecyst|breast|thyroidect|burn|obstruction|peptic ulcer|haematemesis|hematemesis|haemorrhage|hemorrhage|operative|incision|drain|dislocation|osteomyelitis|amputat|transplant|resection|laparotom|surgical"),
    ("Medicine", r"chest pain|\bECG\b|myocardial|\bheart\b|cardiac|hypertens|diabet|thyroid|renal|liver|cirrhos|pulmonary|pleural|edema|oedema|pneumonia|asthma|\bCOPD\b|abdominal|diarrh|\bfever\b|\bcough\b|dyspnea|dyspnoea|\bshock\b|sepsis|\bcoma\b|seizure|stroke|hemiplegia|parkinson|multiple sclerosis|\bAMI\b|hematuria|haematuria"),
]


def topic_from_keywords(text):
    for topic, pattern in TOPIC_KEYWORDS:
        if re.search(pattern, text, re.I):
            return topic
    return None


def is_composite(chapter):
    c = (chapter or "").strip().lower()
    return ("," in c or " and " in c or c in {"loksewa", "general health services", "general", ""})


def chapter_topic(chapter):
    c = (chapter or "").lower()
    for pattern, topic in CHAPTER_MAP:
        if re.search(pattern, c):
            return topic
    return None


def classify(question):
    chapter = question.get("chapter", "") or ""
    stem = str(question.get("stem", "") or "")
    expl = str(question.get("explanation", "") or "")
    found = [label for label, _, pat in CONCEPTS
             if re.search(pat, stem, re.I)]
    if not found:
        found = [label for label, _, pat in CONCEPTS
                 if re.search(pat, expl[:500], re.I)]
    topic = chapter_topic(chapter)
    if is_composite(chapter) or not topic:
        votes = Counter(parent for label, parent, _ in CONCEPTS if label in found)
        if votes:
            topic = votes.most_common(1)[0][0]
        else:
            topic = (topic_from_keywords(stem) or
                     topic_from_keywords(expl[:500]) or
                     "General Health Services")
    return topic, found


def norm_stem(stem):
    return re.sub(r"[^a-z0-9]+", " ", str(stem).lower()).strip()


# ---------- analysis ----------
def analyze(sets):
    years = sorted({s["year"] for s in sets if s["year"]})
    recent_years = set(years[-3:])  # last three exam years present
    total_questions = sum(len(s["questions"]) for s in sets)
    recent_questions = sum(len(s["questions"]) for s in sets if s["year"] in recent_years)

    topics = {}
    concept_stats = {}
    by_topic = defaultdict(dict)
    seen = {}

    for st in sets:
        for q in st["questions"]:
            topic, concepts = classify(q)
            rec = topics.setdefault(topic, {"total": 0, "years": Counter(), "sets": set()})
            rec["total"] += 1
            rec["years"][st["year"]] += 1
            rec["sets"].add(st["id"])

            stem = str(q.get("stem", "") or "").strip()
            key = norm_stem(stem)
            item = by_topic[topic].setdefault(key, {
                "stem": stem, "banks": [], "years": set(), "concepts": set(), "hits": 0,
            })
            item["banks"].append({"name": st["name"], "id": st["id"], "n": q.get("n", "")})
            item["years"].add(st["year"])
            item["concepts"].update(concepts)
            item["hits"] += 1
            seen[key] = item

            for label in concepts:
                c = concept_stats.setdefault(label, {
                    "total": 0, "years": Counter(), "sets": set(), "topic": "",
                })
                c["total"] += 1
                c["years"][st["year"]] += 1
                c["sets"].add(st["id"])
                c["topic"] = next((p for n, p, _ in CONCEPTS if n == label), "")

    max_total = max((v["total"] for v in topics.values()), default=1)
    max_sets = len(sets)
    max_recent = max((sum(v for y, v in rec["years"].items() if y in recent_years)
                      for rec in topics.values()), default=1)

    topic_rows = []
    for name, rec in topics.items():
        recent = sum(v for y, v in rec["years"].items() if y in recent_years)
        share = rec["total"] / total_questions
        recent_share = recent / recent_questions if recent_questions else 0
        ratio = recent_share / share if share else 0
        trend = "Rising" if ratio >= 1.15 else ("Cooling" if ratio <= 0.8 else "Steady")
        score = round(100 * (0.45 * rec["total"] / max_total +
                             0.35 * len(rec["sets"]) / max_sets +
                             0.20 * recent / max_recent))
        examples = sorted(by_topic[name].values(),
                          key=lambda x: (-len(x["banks"]), -max(x["years"]), -x["hits"]))
        topic_rows.append({
            "name": name, "total": rec["total"], "sets": len(rec["sets"]),
            "years": dict(sorted(rec["years"].items())), "recent": recent,
            "share": round(share * 100, 1), "trend": trend, "score": score,
            "examples": examples,
        })
    topic_rows.sort(key=lambda r: (-r["score"], -r["total"], r["name"]))

    concept_rows = []
    for label, rec in concept_stats.items():
        recent = sum(v for y, v in rec["years"].items() if y in recent_years)
        score = round(100 * (0.5 * len(rec["sets"]) / max_sets +
                             0.3 * rec["total"] / max((c["total"] for c in concept_stats.values()), default=1) +
                             0.2 * recent / max((sum(v for y, v in c["years"].items() if y in recent_years)
                                                 for c in concept_stats.values()), default=1)))
        concept_rows.append({
            "name": label, "topic": rec["topic"], "total": rec["total"],
            "sets": len(rec["sets"]), "years": dict(sorted(rec["years"].items())),
            "recent": recent, "score": score,
        })
    concept_rows.sort(key=lambda r: (-r["score"], -r["sets"], -r["total"], r["name"]))

    return {
        "sets": [{"name": s["name"], "year": s["year"], "count": len(s["questions"]), "id": s["id"]} for s in sets],
        "years": years, "recent_years": sorted(recent_years),
        "total_questions": total_questions, "recent_questions": recent_questions,
        "topic_rows": topic_rows, "concept_rows": concept_rows,
    }


# ---------- rendering ----------
def bar(value, maximum, color="#168a78"):
    pct = 100 * value / maximum if maximum else 0
    return (f'<span class="bar"><span class="bar-fill" style="width:{pct:.1f}%;'
            f'background:{color}"></span></span>')


def year_cells(years_map, all_years):
    out = []
    for y in all_years:
        n = years_map.get(y, 0)
        cls = "y0" if not n else ("y3" if n >= 10 else ("y2" if n >= 5 else "y1"))
        out.append(f'<span class="ycell {cls}" title="{y}: {n} questions">{n or "·"}</span>')
    return "".join(out)


def stem_text(stem, limit=190):
    one = re.sub(r"\s+", " ", stem).strip()
    return one if len(one) <= limit else one[:limit].rsplit(" ", 1)[0] + "…"


def render(analysis):
    sets = analysis["sets"]
    years = analysis["years"]
    topics = analysis["topic_rows"]
    concepts = analysis["concept_rows"]
    max_topic = max((t["total"] for t in topics), default=1)
    max_concept = max((c["total"] for c in concepts), default=1)
    esc = html.escape

    set_chips = "".join(
        f'<span class="chip">{esc(s["name"])} <b>{s["count"]}</b></span>' for s in sets)

    topic_rows_html = []
    for i, t in enumerate(topics, 1):
        trend_cls = {"Rising": "up", "Cooling": "down", "Steady": "flat"}[t["trend"]]
        topic_rows_html.append(f"""<tr>
<td class="rank">{i}</td>
<td class="tname">{esc(t['name'])}</td>
<td class="num">{t['total']}</td>
<td>{bar(t['total'], max_topic)}</td>
<td class="num">{t['share']}%</td>
<td class="num">{t['sets']}/{len(sets)}</td>
<td class="num">{t['recent']}</td>
<td>{year_cells(t['years'], years)}</td>
<td><span class="trend {trend_cls}">{t['trend']}</span></td>
<td class="num score">{t['score']}</td>
</tr>""")

    heat_head = "".join(f'<th>{y}</th>' for y in years)
    heat_rows = []
    for t in topics[:16]:
        heat_rows.append(f'<tr><td class="tname">{esc(t["name"])}</td>'
                         f'{year_cells(t["years"], years)}</tr>')

    concept_rows_html = []
    for i, c in enumerate(concepts[:30], 1):
        concept_rows_html.append(f"""<tr>
<td class="rank">{i}</td>
<td class="tname">{esc(c['name'])}</td>
<td class="sub">{esc(c['topic'])}</td>
<td class="num">{c['total']}</td>
<td>{bar(c['total'], max_concept, '#7c3aed')}</td>
<td class="num">{c['sets']}/{len(sets)}</td>
<td>{year_cells(c['years'], years)}</td>
<td class="num score">{c['score']}</td>
</tr>""")

    prediction_cards = []
    for rank, t in enumerate(topics[:6], 1):
        why = []
        if t["sets"] >= len(sets) * 0.6:
            why.append(f"appears in {t['sets']} of {len(sets)} papers")
        if t["trend"] == "Rising":
            why.append("share is rising in recent papers")
        why.append(f"{t['total']} questions in total")
        qs = []
        for ex in t["examples"][:3]:
            years_txt = ", ".join(str(y) for y in sorted(ex["years"]))
            bank = ex["banks"][0]
            link = f'surgery-practice.html?bank={esc(bank["id"], quote=True)}'
            label = " · ".join(sorted(ex["concepts"])[:2]) or t["name"]
            qs.append(f"""<li><a href="{link}" title="{esc(ex['stem'], quote=True)}">{esc(stem_text(ex['stem']))}</a>
<div class="qmeta">{esc(label)} · {esc(bank['name'])} · {years_txt} · Q{esc(str(bank['n']))}</div></li>""")
        prediction_cards.append(f"""<div class="pcard">
<div class="ph"><span class="prank">#{rank}</span><span class="pname">{esc(t['name'])}</span><span class="pscore">{t['score']}</span></div>
<div class="pwhy">{' · '.join(esc(w) for w in why)}</div>
<ol class="qlist">{''.join(qs)}</ol>
</div>""")

    generated = datetime.now().strftime("%d %b %Y")
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loksewa Topic Analyzer &amp; Predictor — MedArena</title>
<style>
:root{{--teal:#0f766e;--ink:#172640;--mut:#64748b;--line:#e2e8f0;--bg:#f6f9fc}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 system-ui,"Segoe UI",Roboto,sans-serif}}
.wrap{{max-width:1180px;margin:0 auto;padding:24px 18px 60px}}
header{{background:linear-gradient(135deg,#0f766e,#1d4ed8);color:#fff;border-radius:18px;padding:26px 28px;box-shadow:0 14px 34px rgba(15,118,110,.25)}}
header h1{{margin:0;font-size:26px;letter-spacing:-.5px}}
header p{{margin:8px 0 0;opacity:.92;max-width:800px}}
.back{{display:inline-block;margin-bottom:14px;color:var(--teal);font-weight:700;text-decoration:none}}
.stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:18px 0}}
.stat{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px}}
.stat b{{display:block;font-size:24px;color:var(--teal);line-height:1.2}}
.stat span{{font-size:12px;color:var(--mut)}}
section.card{{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin-top:18px;box-shadow:0 2px 10px rgba(15,23,42,.03)}}
h2{{margin:0 0 4px;font-size:19px}}
.note{{color:var(--mut);font-size:12.5px;margin:0 0 14px}}
.chips{{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}}
.chip{{background:#f1f5f9;border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:11.5px;color:#475569}}
.chip b{{color:var(--teal)}}
table{{width:100%;border-collapse:collapse;font-size:12.5px}}
th{{text-align:left;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 7px;border-bottom:1px solid var(--line);white-space:nowrap}}
td{{padding:8px 7px;border-bottom:1px solid #f1f5f9;vertical-align:middle}}
tr:hover td{{background:#fbfdff}}
.rank{{color:var(--mut);width:28px}}
.tname{{font-weight:700;min-width:150px}}
.sub{{color:var(--mut)}}
.num{{text-align:right;white-space:nowrap}}
.score{{font-weight:800;color:var(--teal)}}
.bar{{display:inline-block;width:110px;height:8px;background:#eef2f6;border-radius:99px;overflow:hidden;vertical-align:middle}}
.bar-fill{{display:block;height:100%;border-radius:99px}}
.trend{{font-size:10.5px;font-weight:800;padding:3px 7px;border-radius:99px;white-space:nowrap}}
.trend.up{{background:#dcfce7;color:#166534}}
.trend.down{{background:#fef3c7;color:#92400e}}
.trend.flat{{background:#f1f5f9;color:#475569}}
.ycell{{display:inline-flex;width:30px;height:20px;align-items:center;justify-content:center;border-radius:5px;font-size:10px;font-weight:700;margin-right:2px}}
.y0{{background:#f1f5f9;color:#cbd5e1}}
.y1{{background:#ccfbf1;color:#115e59}}
.y2{{background:#5eead4;color:#134e4a}}
.y3{{background:#0f766e;color:#fff}}
.pred{{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px}}
.pcard{{border:1px solid var(--line);border-radius:13px;padding:14px 16px;background:linear-gradient(180deg,#fff,#fbfdff)}}
.ph{{display:flex;align-items:center;gap:9px}}
.prank{{background:#0f766e;color:#fff;font-weight:800;font-size:11px;border-radius:7px;padding:3px 7px}}
.pname{{font-weight:800;font-size:14.5px;flex:1}}
.pscore{{color:var(--teal);font-weight:800}}
.pwhy{{color:var(--mut);font-size:11.5px;margin:6px 0 8px}}
.qlist{{margin:0;padding-left:18px}}
.qlist li{{margin-bottom:9px;font-size:12.5px}}
.qlist a{{color:#1e293b;text-decoration:none}}
.qlist a:hover{{color:var(--teal);text-decoration:underline}}
.qmeta{{color:var(--mut);font-size:10.5px;margin-top:2px}}
.scroll{{overflow-x:auto}}
footer{{color:var(--mut);font-size:11.5px;text-align:center;margin-top:22px}}
@media(max-width:640px){{.bar{{width:70px}}.ycell{{width:24px}}header h1{{font-size:21px}}}}
</style>
</head>
<body>
<div class="wrap">
<a class="back" href="index.html">← Back to MedArena</a>
<header>
  <h1>🏛️ Loksewa Topic Analyzer &amp; Predictor</h1>
  <p>Scans every real Loksewa paper in MedArena, normalises inconsistent chapter labels, and ranks topics by
     how often they appear, how widely they spread across papers, and how common they are in recent exams.
     “Possible next topics” are ranked from that evidence; the questions shown are <b>real past questions</b>,
     never invented. The aggregated Loksewa mock is excluded to avoid double counting.</p>
</header>

<div class="stats">
  <div class="stat"><b>{len(sets)}</b><span>Loksewa exam papers scanned</span></div>
  <div class="stat"><b>{analysis['total_questions']:,}</b><span>questions analysed</span></div>
  <div class="stat"><b>{len(topics)}</b><span>normalised topics</span></div>
  <div class="stat"><b>{len(concepts)}</b><span>recurring concepts tracked</span></div>
  <div class="stat"><b>{', '.join(str(y) for y in analysis['recent_years'])}</b><span>recent years weighted for trends</span></div>
</div>

<section class="card">
  <h2>Papers included</h2>
  <p class="note">Sorted by exam year. Counts are the questions actually in each bank.</p>
  <div class="chips">{set_chips}</div>
</section>

<section class="card">
  <h2>1 · Which topics are asked most?</h2>
  <p class="note">Score = 45% volume + 35% spread across papers + 20% recent-paper frequency. Rising/Cooling compares a topic's share in the last three years with its overall share.</p>
  <div class="scroll"><table>
    <thead><tr><th>#</th><th>Topic</th><th class="num">Qs</th><th>Volume</th><th class="num">Share</th><th class="num">Papers</th><th class="num">Recent</th><th>By year</th><th>Trend</th><th class="num">Score</th></tr></thead>
    <tbody>{''.join(topic_rows_html)}</tbody>
  </table></div>
</section>

<section class="card">
  <h2>2 · Topic-by-year heatmap</h2>
  <p class="note">Darker cell = more questions from that topic in that paper. Top 16 topics shown.</p>
  <div class="scroll"><table>
    <thead><tr><th>Topic</th>{heat_head}</tr></thead>
    <tbody>{''.join(heat_rows)}</tbody>
  </table></div>
</section>

<section class="card">
  <h2>3 · Predicted focus for the next Loksewa</h2>
  <p class="note">Top six topics by priority score, with the highest-signal real questions from past papers. Open any question link to revise it in its original set.</p>
  <div class="pred">{''.join(prediction_cards)}</div>
</section>

<section class="card">
  <h2>4 · Recurring concepts (fine-grained)</h2>
  <p class="note">Detected from question stems using a fixed medical keyword dictionary — repeated across papers means higher exam yield.</p>
  <div class="scroll"><table>
    <thead><tr><th>#</th><th>Concept</th><th>Parent topic</th><th class="num">Mentions</th><th>Frequency</th><th class="num">Papers</th><th>By year</th><th class="num">Score</th></tr></thead>
    <tbody>{''.join(concept_rows_html)}</tbody>
  </table></div>
</section>

<footer>Generated {generated} from MedArena question banks · static, browser-free analysis · stems shown as previews only (answers and explanations stay locked).</footer>
</div>
</body>
</html>
"""


def main():
    sets = load_loksewa_sets()
    if len(sets) < 5:
        raise SystemExit(f"expected the Loksewa banks, found only {len(sets)}")
    analysis = analyze(sets)
    OUT.write_text(render(analysis), encoding="utf-8")
    print(f"wrote {OUT.name}: {OUT.stat().st_size:,} bytes")
    print(f"sets={len(sets)} questions={analysis['total_questions']} "
          f"topics={len(analysis['topic_rows'])} concepts={len(analysis['concept_rows'])}")
    print("top topics:")
    for t in analysis["topic_rows"][:10]:
        print(f"  {t['score']:3d}  {t['total']:4d} qs  {t['sets']:2d} papers  {t['name']}")


if __name__ == "__main__":
    main()
