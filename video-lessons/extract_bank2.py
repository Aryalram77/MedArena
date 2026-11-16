import json, re, sys

html = open(r'C:\Users\pc\usmle-mcq-app\surgery-practice.html', encoding='utf-8').read()
name = sys.argv[1] if len(sys.argv) > 1 else 'GANDAKI2080'
i = html.find('const %s = ' % name)
if i < 0:
    raise SystemExit('const not found')
start = html.find('{', i)
depth = 0
end = None
in_str = False
esc = False
for j in range(start, len(html)):
    c = html[j]
    if esc:
        esc = False
        continue
    if c == '\\':
        esc = True
        continue
    if in_str:
        if c == '"':
            in_str = False
        continue
    if c == '"':
        in_str = True
        continue
    if c == '{':
        depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0:
            end = j + 1
            break
print('end', end)
bank = json.loads(html[start:end])
print('questions', len(bank['questions']))

def speakable(exp):
    lines = []
    for raw_line in exp.split('\n'):
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('|') and stripped.endswith('|'):
            cells = [c.strip() for c in stripped.strip('|').split('|')]
            cells = [c for c in cells if c and not set(c) <= set('-: ')]
            if cells:
                lines.append('. '.join(cells))
            continue
        line = line.replace('`', '').replace('*', '').replace('#', '')
        line = re.sub(r'\s+', ' ', line).strip()
        if line:
            lines.append(line)
    text = '. '.join(lines)
    return re.sub(r'\s{2,}', ' ', text)

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

path = r'C:\Users\pc\usmle-mcq-app\video-lessons\data_%s.json' % name.lower()
with open(path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print('wrote', path, len(out))
print('chapters:', sorted(set(q['chapter'] for q in out))[:12])
