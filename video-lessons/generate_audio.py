import json, re, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import numpy as np
import soundfile as sf
from kokoro import KPipeline

FPS = 30
DATA = r'C:\Users\pc\usmle-mcq-app\video-lessons\data_gandaki2080.json'
AUDIO_DIR = r'C:\Users\pc\usmle-mcq-app\video-lessons\public\audio'
SRC_PLAN = r'C:\Users\pc\usmle-mcq-app\video-lessons\src\plan.json'

PILOT_NS = [1, 3, 4, 5, 2]  # forensic age, phase I trial, sensitivity/specificity, prevention, negligence

questions = {q['n']: q for q in json.load(open(DATA, encoding='utf-8'))}
pilot = [questions[n] for n in PILOT_NS]
print('pilot questions:', [q['n'] for q in pilot])

VOICE = 'af_heart'  # Kokoro warm neutral American female (af_heart). alt: 'am_michael'
SPEED = 0.98

pipeline = KPipeline(lang_code='a')

def synth(text, fname):
    chunks = []
    for i, (gs, ps, audio) in enumerate(pipeline(text, voice=VOICE, speed=SPEED, split_pattern=r'\n+')):
        chunks.append(audio)
    audio = np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.float32)
    sr = 24000
    path = AUDIO_DIR + '\\' + fname
    sf.write(path, audio, sr)
    dur = len(audio) / sr
    print(f'{fname}: {dur:.2f}s')
    return dur

plan_segments = []
for q in pilot:
    n = q['n']
    chapter = q['chapter']
    qname = re.sub(r'\W+', '_', f'q{n:02d}_{chapter}'.lower())[:30]
    letter = q.get('answerLetter')
    answer_text = q.get('answerText') or ''
    spoken = q['explanationSpoken']
    # trim very long explanations to keep lesson pace (first ~110 words)
    words = spoken.split()
    if len(words) > 110:
        spoken = ' '.join(words[:110]) + '.'

    seg = {}
    seg['q_n'] = n
    seg['chapter'] = chapter
    seg['intro_seconds'] = 0.0

    # 1) question line
    stem = re.sub(r'\s+', ' ', q['stem']).strip()
    intro_text = f'Gandaki Loksewa 2080. Medical Officer question {n}. Chapter: {chapter}.'
    seg['intro_dur'] = synth(intro_text, f'{qname}_intro.wav')

    # 2) stem
    seg['question_dur'] = synth(stem, f'{qname}_question.wav')

    # 3) options read
    opt_lines = ['Options.']
    for o in q['options']:
        opt_lines.append(f"{o['letter']}. {o['text']}.")
    seg['options_dur'] = synth(' '.join(opt_lines), f'{qname}_options.wav')

    # 4) answer
    ans_text = f'The correct answer is: {letter}. {answer_text}.'
    seg['answer_dur'] = synth(ans_text, f'{qname}_answer.wav')

    # 5) explanation
    seg['explanation_dur'] = synth('Explanation. ' + spoken, f'{qname}_explanation.wav')

    plan_segments.append(seg)

plan = {
    'fps': FPS,
    'voice': VOICE,
    'lesson_title': 'Gandaki Loksewa 2080 · Medical Officer',
    'segments': [
        {'type': 'cover', 'frames': int(3.5 * FPS)},
    ],
    'outro_frames': int(3.0 * FPS),
}
for seg in plan_segments:
    plan['segments'].append({
        'type': 'question',
        'n': seg['q_n'],
        'chapter': seg['chapter'],
        'frames': {
            'intro': int((seg['intro_dur'] + 0.4) * FPS),
            'question': int((seg['question_dur'] + 0.4) * FPS),
            'options': int((seg['options_dur'] + 0.4) * FPS),
            'reveal': int((seg['answer_dur'] + 0.8) * FPS),
            'explanation': int((seg['explanation_dur'] + 0.5) * FPS),
        },
        'audio': {
            'intro': f'{re.sub(r"\W+", "_", f"q{seg["q_n"]:02d}_{seg["chapter"]}".lower())[:30]}_intro.wav',
            'question': f'{re.sub(r"\W+", "_", f"q{seg["q_n"]:02d}_{seg["chapter"]}".lower())[:30]}_question.wav',
            'options': f'{re.sub(r"\W+", "_", f"q{seg["q_n"]:02d}_{seg["chapter"]}".lower())[:30]}_options.wav',
            'answer': f'{re.sub(r"\W+", "_", f"q{seg["q_n"]:02d}_{seg["chapter"]}".lower())[:30]}_answer.wav',
            'explanation': f'{re.sub(r"\W+", "_", f"q{seg["q_n"]:02d}_{seg["chapter"]}".lower())[:30]}_explanation.wav',
        },
    })

with open(SRC_PLAN, 'w', encoding='utf-8') as f:
    json.dump(plan, f, indent=2)
print('wrote', SRC_PLAN)
