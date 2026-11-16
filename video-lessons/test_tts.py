from kokoro import KPipeline
import soundfile as sf
import io, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

pipeline = KPipeline(lang_code='a')  # American English
print('pipeline ready')
text = 'Gandaki Loksewa 2080. Question one. The Gandaki Medical Officer paper asks: which of the following is true about the proximal phalanx?'
generator = pipeline(text, voice='af_heart', speed=1.0, split_pattern=r'\n+')
chunks = []
for i, (gs, ps, audio) in enumerate(generator):
    chunks.append(audio)
    print('chunk', i, 'len', len(audio))
import numpy as np
audio = np.concatenate(chunks)
sf.write('test_kokoro.wav', audio, 24000)
print('wrote test_kokoro.wav, samples:', len(audio))
