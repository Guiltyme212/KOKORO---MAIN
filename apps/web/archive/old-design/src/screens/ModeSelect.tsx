import { useState } from 'react';
import type { Route } from '../lib/router';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import { Glow, TopBar, Eyebrow, Display, Btn } from '../components/atoms';
import type { Vibe } from '../types';

type VibeCard = {
  key: Vibe;
  skin: 't-raw' | 't-cosmic' | 't-iron' | 't-zen' | 't-sleep';
  tag: string;
  title: string;
  desc: string;
  glyph: string;
};

const VIBES: VibeCard[] = [
  { key: 'raw',    skin: 't-raw',    tag: 'Gen Z · raw',         title: 'no notes. just real shit.',          desc: 'slang, swears, zero corporate.',         glyph: '!?' },
  { key: 'cosmic', skin: 't-cosmic', tag: 'Spiritual · cosmic',  title: 'Align with your higher frequency.',  desc: 'Astrology, chakras, lunar tides.',       glyph: '✦' },
  { key: 'iron',   skin: 't-iron',   tag: 'Hard mode · iron',    title: 'NO EXCUSES. ONLY REPS.',             desc: 'pre-sale · pre-lift · pre-war.',         glyph: '力' },
  { key: 'zen',    skin: 't-zen',    tag: 'Zen · 禅',            title: 'Sit. Breathe. Watch it pass.',       desc: 'One breath, then the next.',             glyph: '無' },
  { key: 'sleep',  skin: 't-sleep',  tag: 'Bedtime · 夢',         title: 'Drift. Let the day go.',             desc: 'Slow voice, low frequencies, moonlight.', glyph: '夢' },
];

export function ModeSelect({ goto }: { goto: (r: Route) => void }) {
  const { answers, setAnswer } = useAnswers();
  const [pick, setPick] = useState<Vibe>(answers.vibe || 'zen');

  const onContinue = () => {
    setAnswer('vibe', pick);
    haptic.light();
    goto('composing');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', color: 'var(--ink)' }}>
      <Glow intensity={0.10} />
      <TopBar onBack={() => goto('mirror')} center="how should it hit?" />

      <div style={{ padding: '14px 28px 0' }}>
        <Eyebrow>— mode —</Eyebrow>
        <div style={{ height: 8 }} />
        <Display size={28}>How should it hit?</Display>
      </div>

      <div style={{
        position: 'absolute', top: 184, bottom: 110, left: 0, right: 0,
        padding: '0 24px', overflowY: 'auto',
      }}>
        <div className="mode-grid-v2">
          {VIBES.map((vibe) => {
            const sel = vibe.key === pick;
            return (
              <button
                key={vibe.key}
                className={`mode-tile ${vibe.skin}${sel ? ' sel' : ''}`}
                onClick={() => { haptic.selection(); setPick(vibe.key); }}
                aria-pressed={sel}
              >
                <span className="mode-tile-bg" />
                <span className="mode-tile-check">✓</span>
                <span className="mode-tile-glyph">{vibe.glyph}</span>
                <span className="mode-tile-content">
                  <span className="mode-tile-tag">{vibe.tag}</span>
                  <span>
                    <div className="mode-tile-title">{vibe.title}</div>
                    <div className="mode-tile-desc">{vibe.desc}</div>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 22px' }}>
        <Btn full onClick={onContinue}>Compose for me</Btn>
      </div>
    </div>
  );
}
