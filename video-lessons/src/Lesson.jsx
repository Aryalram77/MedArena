import React from 'react';
import {
  AbsoluteFill,
  Series,
  Sequence,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

import data from './data_gandaki2080.json';
import plan from './plan.json';

const FPS = 30;

// ------- classical palette -------
const C = {
  paper: '#FBF8EF',
  paperShadow: '#ECE5D4',
  ink: '#22303F',
  navy: '#1F3A5F',
  burgundy: '#7B2231',
  gold: '#B08D2F',
  goldLight: '#C9A227',
  goldBright: '#E4C766',
  deepGreen: '#14532D',
  softInk: '#4A4039',
  muted: '#8A7C5B',
};

const SERIF = '"Georgia", Georgia, serif';
const DISPLAY = '"Bodoni MT", "Bodoni 72", Georgia, serif';

const font = (size, { family = SERIF, weight = 400, style = 'normal', letterSpacing } = {}) => ({
  fontFamily: family,
  fontSize: size,
  fontWeight: weight,
  fontStyle: style,
  letterSpacing: letterSpacing ?? 'normal',
});

// ------- shared frame chrome -------
const ClassicalFrame = ({ children, chapter }) => {
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 35%, #FFFDF6 0%, #F6F0E4 58%, #ECE5D4 100%)' }}>
      {/* faint parchment vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(90,70,30,0.10) 100%)',
        }}
      />
      {/* outer gold hairline frame */}
      <AbsoluteFill style={{ inset: 22, border: `2px solid ${C.gold}`, position: 'absolute' }} />
      {/* inner double frame */}
      <AbsoluteFill style={{ inset: 32, border: `1px solid ${C.gold}`, position: 'absolute' }} />
      {/* corner ornaments */}
      {[
        { top: 30, left: 34 },
        { top: 30, right: 34 },
        { bottom: 30, left: 34 },
        { bottom: 30, right: 34 },
      ].map((pos, i) => (
        <div key={i} style={{ position: 'absolute', ...pos, color: C.gold, fontSize: 26 }}>
          ✦
        </div>
      ))}
      {/* top brand */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...font(15, { family: DISPLAY, weight: 700, letterSpacing: 8 }), color: C.navy }}>
          M E D A R E N A
        </div>
        <div style={{ ...font(11, { family: SERIF, weight: 400, letterSpacing: 6 }), color: C.gold, marginTop: 2 }}>
          M E D I C A L &nbsp;O F F I C E R
        </div>
      </div>
      {/* top chapter tag */}
      {chapter && (
        <div
          style={{
            position: 'absolute',
            top: 78,
            right: 60,
            ...font(13, { family: SERIF, weight: 600, letterSpacing: 3 }),
            color: C.burgundy,
            textTransform: 'uppercase',
          }}
        >
          {chapter}
        </div>
      )}
      {children}
      {/* footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          textAlign: 'center',
          ...font(12.5, { family: SERIF, weight: 400, letterSpacing: 2.5 }),
          color: C.muted,
          textTransform: 'uppercase',
        }}
      >
        MedArena&nbsp;&nbsp;·&nbsp;&nbsp;Gandaki Loksewa 2080&nbsp;&nbsp;·&nbsp;&nbsp;Medical Officer
      </div>
      {/* bottom gold hairline */}
      <div
        style={{
          position: 'absolute',
          bottom: 34,
          left: 500,
          right: 500,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ------- cover/intro plate -------
const Cover = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, 40], [0.92, 1], { extrapolateRight: 'clamp' });
  const opacity = interpolate(frame, [0, 35], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <ClassicalFrame chapter={null}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        {/* ornament top */}
        <div style={{ ...font(30, { family: DISPLAY }), color: C.gold }}>❦</div>
        <div style={{ height: 6 }} />
        <div style={{ ...font(88, { family: DISPLAY, weight: 700, letterSpacing: 2 }), color: C.navy }}>
          G A N D A K I
        </div>
        <div style={{ ...font(58, { family: DISPLAY, weight: 400, letterSpacing: 16 }), color: C.gold, marginTop: 2 }}>
          L O K S E W A
        </div>
        <div style={{ height: 10 }} />
        {/* gold rule with diamond */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 340, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold})` }} />
          <div style={{ color: C.gold, fontSize: 20 }}>◆</div>
          <div style={{ width: 340, height: 1.5, background: `linear-gradient(270deg, transparent, ${C.gold})` }} />
        </div>
        <div style={{ height: 22 }} />
        <div style={{ ...font(34, { family: SERIF, weight: 400, letterSpacing: 4 }), color: C.burgundy }}>
          M E D I C A L &nbsp;O F F I C E R
        </div>
        <div style={{ ...font(17, { family: SERIF, weight: 400, letterSpacing: 5, style: 'italic' }), color: C.softInk, marginTop: 22 }}>
          A High-Yield Lesson · Classical Edition
        </div>
        <div style={{ ...font(24, { family: DISPLAY, weight: 700, letterSpacing: 4, color: C.gold }), color: C.gold, marginTop: 8 }}>
          F I V E &nbsp; Q U E S T I O N S
        </div>
        <div style={{ height: 30 }} />
        <div
          style={{
            ...font(17, { family: SERIF, weight: 600, letterSpacing: 4 }),
            color: C.navy,
            border: `1px solid ${C.gold}`,
            padding: '10px 26px',
            borderRadius: 2,
            textTransform: 'uppercase',
          }}
        >
          Gandaki Loksewa 2080
        </div>
        <div style={{ height: 8 }} />
        <div style={{ ...font(15, { family: SERIF, weight: 400, letterSpacing: 2 }), color: C.muted }}>
          MedArena · aryalram77.github.io/MedArena
        </div>
      </div>
    </ClassicalFrame>
  );
};

// Small helpers
const springy = (frame, delay, config = { damping: 18, stiffness: 80, mass: 0.9 }) =>
  spring({ frame: frame - delay, fps: FPS, config });

// Chapter badge
const QuestionMedallion = ({ n, size = 170, color = C.gold }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: `radial-gradient(circle at 50% 35%, #FFFBEB 0%, #F1E6C8 100%)`,
      border: `3px double ${C.gold}`,
      boxShadow: '0 6px 22px rgba(90,70,30,0.25), inset 0 0 18px rgba(176,141,47,0.35)',
    }}
  >
    <div style={{ ...font(15, { family: DISPLAY, weight: 700, letterSpacing: 3 }), color: C.gold }}>Q</div>
    <div style={{ ...font(size * 0.42, { family: DISPLAY, weight: 700 }), color: C.navy, lineHeight: 1.05 }}>
      {n}
    </div>
  </div>
);

// Options block
const OptionsList = ({ options, startFrame, reveal = false, correctLetter, dimOthers = false }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
      {options.map((o, i) => {
        const rise = spring({
          frame: frame - startFrame - i * 14,
          fps: FPS,
          config: { damping: 17, stiffness: 90, mass: 0.8 },
        });
        const isCorrect = reveal && o.letter === correctLetter;
        const dimmed = reveal && dimOthers && o.letter !== correctLetter;
        return (
          <div
            key={o.letter}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              background: isCorrect ? 'linear-gradient(90deg, #164E33 0%, #1E5A3C 100%)' : '#FFFDF8',
              border: isCorrect ? `2px solid ${C.goldBright}` : `1.5px solid ${C.goldLight}`,
              borderRadius: 6,
              padding: '14px 22px',
              boxShadow: isCorrect ? '0 10px 34px rgba(20,83,45,0.35)' : '0 3px 10px rgba(90,70,30,0.10)',
              opacity: interpolate(rise, [0, 0.2, 1], [0, 1, 1]) * (dimmed ? 0.32 : 1),
              transform: `translateY(${(1 - rise) * 44}px) scale(${interpolate(rise, [0, 1], [0.94, 1])})`,
            }}
          >
            {/* letter medallion */}
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isCorrect ? C.goldBright : C.navy,
                color: isCorrect ? C.deepGreen : C.goldBright,
                ...font(28, { family: DISPLAY, weight: 700 }),
                border: isCorrect ? `2px solid #8A6F1B` : `2px solid ${C.gold}`,
                boxShadow: 'inset 0 0 8px rgba(0,0,0,0.2)',
              }}
            >
              {o.letter}
            </div>
            <div
              style={{
                ...font(26.5, { family: SERIF, weight: 400 }),
                color: isCorrect ? '#FFFDF2' : C.ink,
                lineHeight: 1.3,
                flex: 1,
              }}
            >
              {o.text}
            </div>
            {isCorrect && (
              <div
                style={{
                  flexShrink: 0,
                  ...font(15, { family: SERIF, weight: 700, letterSpacing: 3 }),
                  color: '#F5DE8A',
                  textTransform: 'uppercase',
                }}
              >
                ✓ Correct
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Chapter tag
const ChapterTag = ({ chapter }) => (
  <div
    style={{
      alignSelf: 'center',
      ...font(15, { family: SERIF, weight: 600, letterSpacing: 4 }),
      color: C.burgundy,
      textTransform: 'uppercase',
      border: `1px solid ${C.gold}`,
      borderRadius: 2,
      padding: '6px 18px',
      background: 'rgba(201,162,39,0.08)',
    }}
  >
    {chapter}
  </div>
);

// Question scene (intro + question reading phases share layout)
const QuestionScene = ({ q, phase, delay0 }) => {
  const frame = useCurrentFrame();
  const meda = spring({ frame: frame - 4, fps: FPS, config: { damping: 15, stiffness: 70, mass: 0.9 } });
  return (
    <ClassicalFrame chapter={q.chapter}>
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 90,
          right: 90,
          bottom: 95,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <div
            style={{
              transform: `scale(${meda})`,
              opacity: meda,
            }}
          >
            <QuestionMedallion n={q.n} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ ...font(17, { family: SERIF, weight: 400, letterSpacing: 5 }), color: C.gold, textTransform: 'uppercase' }}>
              Question
            </div>
            <ChapterTag chapter={q.chapter} />
            <div style={{ ...font(13, { family: SERIF, weight: 400, letterSpacing: 2 }), color: C.muted, textTransform: 'uppercase' }}>
              Medical Officer · Gandaki 80
            </div>
          </div>
        </div>
        {/* stem panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FFFDF8',
            border: `1px solid ${C.goldLight}`,
            borderRadius: 8,
            padding: '28px 48px',
            width: '100%',
            boxShadow: 'inset 0 0 40px rgba(176,141,47,0.10), 0 8px 26px rgba(90,70,30,0.10)',
          }}
        >
          <div style={{ ...font(29, { family: SERIF, weight: 400 }), color: C.ink, textAlign: 'left', lineHeight: 1.42 }}>
            {q.stem}
          </div>
        </div>
      </div>
    </ClassicalFrame>
  );
};

// Options scene
const OptionsScene = ({ q, startFrame = 0 }) => {
  return (
    <ClassicalFrame chapter={q.chapter}>
      <div
        style={{
          position: 'absolute',
          top: 118,
          left: 120,
          right: 120,
          bottom: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 26,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...font(19, { family: SERIF, weight: 400, letterSpacing: 6 }), color: C.gold, textTransform: 'uppercase' }}>
            Choose the best answer
          </div>
          <div style={{ ...font(14, { family: SERIF, letterSpacing: 2 }), color: C.burgundy, marginTop: 2 }}>
            GANDAKI LOKSEWA 2080&nbsp;&nbsp;·&nbsp;&nbsp;Q {q.n}
          </div>
        </div>
        <OptionsList options={q.options} startFrame={startFrame} />
      </div>
    </ClassicalFrame>
  );
};

// Reveal scene
const RevealScene = ({ q, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const halo = interpolate(frame % 120, [0, 60], [0.6, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <ClassicalFrame chapter={q.chapter}>
      <div
        style={{
          position: 'absolute',
          top: 118,
          left: 120,
          right: 120,
          bottom: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 26,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...font(19, { family: SERIF, weight: 400, letterSpacing: 6 }), color: C.gold, textTransform: 'uppercase' }}>
            The correct answer
          </div>
        </div>
        <OptionsList options={q.options} startFrame={0} reveal correctLetter={q.answerLetter} dimOthers />
        {/* answer ribbon */}
        <div
          style={{
            alignSelf: 'center',
            background: `linear-gradient(90deg, ${C.deepGreen}, #1E5A3C, ${C.deepGreen})`,
            border: `1.5px solid ${C.goldBright}`,
            color: '#F5DE8A',
            borderRadius: 4,
            padding: '10px 34px',
            ...font(22, { family: SERIF, weight: 700, letterSpacing: 2 }),
            boxShadow: '0 10px 28px rgba(20,83,45,0.35)',
            opacity: halo,
          }}
        >
          Answer:&nbsp;&nbsp;{q.answerLetter} — {q.answerText}
        </div>
      </div>
    </ClassicalFrame>
  );
};

// Explanation formatting helpers
const parseExpl = (exp) => {
  const lines = exp.split('\n').map((l) => l.replace(/\r/g, ''));
  const bullets = [];
  const tables = [];
  let curBullets = [];
  let curTable = null;
  const flushBullets = () => {
    if (curBullets.length) {
      bullets.push([...curBullets]);
      curBullets = [];
    }
  };
  const flushTable = () => {
    if (curTable && curTable.length) {
      tables.push(curTable);
      curTable = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length >= 2 && cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) continue; // separator
      flushBullets();
      curTable = curTable || [];
      curTable.push(cells);
      continue;
    }
    flushTable();
    const isBullet = /^[-•✦]/.test(line);
    const isHeading = /^[A-Z0-9][A-Za-z0-9 &\-]{4,}:$/.test(line);
    if (isHeading) {
      flushBullets();
      bullets.push({ heading: line.replace(/:$/, '') });
    } else if (isBullet) {
      curBullets.push(line.replace(/^[-•✦]\s*/, ''));
    } else {
      // plain paragraph: attach as single bullet-ish line
      flushBullets();
      bullets.push([line]);
    }
  }
  flushBullets();
  flushTable();
  return { bullets, tables };
};

// Explanation scene
const ExplanationScene = ({ q }) => {
  const { bullets, tables } = parseExpl(q.explanation || '');
  const frame = useCurrentFrame();

  // flatten bullet groups into a single list of display items with type
  const items = [];
  for (const b of bullets) {
    if (!Array.isArray(b)) {
      items.push({ type: 'heading', text: b.heading });
    } else {
      b.forEach((t) => items.push({ type: 'bullet', text: t }));
    }
  }
  // include up to 7 important lines to avoid overflow
  const shown = items.slice(0, 8);

  return (
    <ClassicalFrame chapter={q.chapter}>
      <div
        style={{
          position: 'absolute',
          top: 116,
          left: 130,
          right: 130,
          bottom: 92,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* heading */}
        <div style={{ textAlign: 'center', marginBottom: 2 }}>
          <div style={{ ...font(28, { family: DISPLAY, weight: 700, letterSpacing: 4 }), color: C.burgundy }}>
            <span style={{ color: C.gold }}>❧ </span>EXPLANATION<span style={{ color: C.gold }}> ❧</span>
          </div>
          {/* gold rule with diamond */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 6 }}>
            <div style={{ width: 150, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold})` }} />
            <div style={{ color: C.gold, fontSize: 14 }}>◆</div>
            <div style={{ width: 150, height: 1.5, background: `linear-gradient(270deg, transparent, ${C.gold})` }} />
          </div>
        </div>

        {/* answer recap strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: C.navy,
            borderRadius: 4,
            padding: '10px 18px',
            border: `1.5px solid ${C.gold}`,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: C.goldBright,
              color: C.deepGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...font(24, { family: DISPLAY, weight: 700 }),
              flexShrink: 0,
            }}
          >
            {q.answerLetter}
          </div>
          <div style={{ ...font(19, { family: SERIF, weight: 400 }), color: '#F7F1DE' }}>
            {q.answerText}
          </div>
        </div>

        {/* bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 2 }}>
          {shown.map((it, i) => {
            const enter = spring({ frame: frame - 10 - i * 8, fps: FPS, config: { damping: 18, stiffness: 110 } });
            const y = (1 - enter) * 26;
            if (it.type === 'heading') {
              return (
                <div key={i} style={{ opacity: enter, transform: `translateY(${y}px)` }}>
                  <span
                    style={{
                      ...font(16, { family: SERIF, weight: 700, letterSpacing: 3 }),
                      color: C.burgundy,
                      textTransform: 'uppercase',
                      borderBottom: `2px solid ${C.gold}`,
                      paddingBottom: 2,
                    }}
                  >
                    {it.text}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  opacity: enter,
                  transform: `translateY(${y}px)`,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ color: C.gold, fontSize: 19, lineHeight: 1.15, flexShrink: 0 }}>❧</span>
                <span style={{ ...font(16.5, { family: SERIF, weight: 400 }), color: C.ink, lineHeight: 1.38 }}>
                  {it.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* table if present */}
        {tables.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {tables[0].slice(0, 5).map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  borderBottom: `1px solid ${i === 0 ? C.gold : 'rgba(176,141,47,0.35)'}`,
                  background: i === 0 ? C.navy : i % 2 ? 'rgba(201,162,39,0.07)' : 'transparent',
                }}
              >
                {row.map((cell, j) => (
                  <div
                    key={j}
                    style={{
                      flex: 1,
                      padding: '5px 10px',
                      ...font(14, {
                        family: SERIF,
                        weight: i === 0 ? 700 : 400,
                        letterSpacing: i === 0 ? 1.5 : 0.3,
                      }),
                      color: i === 0 ? '#F5DE8A' : C.ink,
                      textTransform: i === 0 ? 'uppercase' : 'none',
                    }}
                  >
                    {cell}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </ClassicalFrame>
  );
};

// Outro card
const Outro = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <ClassicalFrame chapter={null}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          gap: 10,
        }}
      >
        <div style={{ fontSize: 40, color: C.gold }}>❦</div>
        <div style={{ ...font(42, { family: DISPLAY, weight: 700, letterSpacing: 6 }), color: C.navy }}>
          Well Done
        </div>
        <div style={{ ...font(20, { family: SERIF, weight: 400, letterSpacing: 4 }), color: C.burgundy, textTransform: 'uppercase' }}>
          High-Yield Revision · Gandaki 2080
        </div>
        <div
          style={{
            ...font(17, { family: SERIF, letterSpacing: 2 }),
            color: C.softInk,
            marginTop: 8,
            borderTop: `1px solid ${C.gold}`,
            borderBottom: `1px solid ${C.gold}`,
            padding: '12px 30px',
          }}
        >
          Continue at aryalram77.github.io/MedArena
        </div>
      </div>
    </ClassicalFrame>
  );
};

export default function Lesson() {
  const segments = plan.segments;
  const questionsByN = Object.fromEntries(data.map((q) => [q.n, q]));

  let cursor = 0;
  const parts = [];

  const seq = (node, durFrames, key, aud) => {
    parts.push(
      <Series.Sequence key={key} durationInFrames={durFrames} name={key}>
        {aud && <Audio src={staticFile(`audio/${aud}`)} />}
        {node}
      </Series.Sequence>
    );
    cursor += durFrames;
  };

  for (const seg of segments) {
    if (seg.type === 'cover') {
      seq(<Cover />, seg.frames, 'cover', null);
      continue;
    }
    const q = questionsByN[seg.n];
    const f = seg.frames;
    const a = seg.audio;
    // intro label (very short)
    seq(<QuestionScene q={q} phase="intro" />, f.intro, `q${seg.n}-intro`, a.intro);
    // stem read
    seq(<QuestionScene q={q} phase="question" />, f.question, `q${seg.n}-question`, a.question);
    // options
    seq(<OptionsScene q={q} startFrame={15} />, f.options, `q${seg.n}-options`, a.options);
    // reveal
    seq(<RevealScene q={q} startFrame={0} />, f.reveal, `q${seg.n}-reveal`, a.answer);
    // explanation
    seq(<ExplanationScene q={q} />, f.explanation, `q${seg.n}-explanation`, a.explanation);
  }
  seq(<Outro />, plan.outro_frames, 'outro', null);

  return <Series>{parts}</Series>;
}

export { Cover, Outro };
