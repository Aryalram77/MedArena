import io, json, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

html = io.open(r'C:\Users\pc\usmle-mcq-app\surgery-practice.html', encoding='utf-8').read()
m = re.search(r'const DERMATOLOGY = (\{.*?\n\});\s*\n', html, re.S)
if not m:
    # fallback: match up to ';const '
    m = re.search(r'const DERMATOLOGY = (\{.*?\});\n', html, re.S)
print('found', bool(m))
bank = json.loads(m.group(1))
print('questions', len(bank['questions']))

# Clean explanation into speakable text: drop markdown tables, headings markers, urls
def speakable(exp):
    lines = []
    for raw_line in exp.split('\n'):
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        # drop table separator rows / table rows but keep their content readable
        if stripped.startswith('|') and stripped.endswith('|'):
            cells = [c.strip() for c in stripped.strip('|').split('|')]
            cells = [c for c in cells if c and not set(c) <= set('-: ')]
            if cells:
                lines.append('. '.join(cells))
            continue
        # drop backticks, bold markers, etc.
        line = line.replace('`', '').replace('*', '').replace('#', '')
        line = re.sub(r'\s+', ' ', line).strip()
        if line:
            lines.append(line)
    text = '. '.join(lines)
    text = re.sub(r'\s{2,}', ' ', text)
    return text

out = []
for q in bank['questions']:
    out.append({
        'n': q['n'],
        'chapter': q.get('chapter', ''),
        'stem': q['stem'],
        'options': q['options'],
        'answerLetter': q.get('answerLetter'),
        'answerText': q.get('answerText'),
        'explanation': q.get('explanation', ''),
        'explanationSpoken': speakable(q.get('explanation', '')),
    })

with io.open(r'C:\Users\pc\usmle-mcq-app\video-lessons\data.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print('wrote data.json with', len(out), 'questions')
# print a sample speakable
print('---SAMPLE SPEAKABLE (Q1)---')
print(out[0]['explanationSpoken'][:400])
