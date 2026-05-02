import { useState } from 'react';
import type { Route } from '../lib/router';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import { Glow, TopBar, Eyebrow, Display, Btn } from '../components/atoms';
import type { Becoming } from '../types';

const STATES: { id: Becoming; label: string; kanji: string; desc: string }[] = [
  { id: 'calm',       label: 'Calm',        kanji: '静', desc: 'Settle the body.' },
  { id: 'sleep',      label: 'Sleep',       kanji: '夜', desc: 'Wind all the way down.' },
  { id: 'focus',      label: 'Focus',       kanji: '集', desc: 'Sharpen for one task.' },
  { id: 'detachment', label: 'Detachment',  kanji: '空', desc: 'Step back from it.' },
  { id: 'confidence', label: 'Confidence',  kanji: '信', desc: 'Stand inside yourself.' },
  { id: 'softness',   label: 'Softness',    kanji: '柔', desc: 'Be kinder to you.' },
  { id: 'power',      label: 'Power',       kanji: '力', desc: 'Make the next move.' },
  { id: 'future',     label: 'Future self', kanji: '未', desc: "Rehearse the life you're building." },
  { id: 'action',     label: 'One action',  kanji: '行', desc: 'One concrete next step.' },
];

export function Transition({ goto }: { goto: (r: Route) => void }) {
  const { answers, setAnswer } = useAnswers();
  const [picked, setPicked] = useState<Becoming>(answers.becoming || 'calm');
  const choice = STATES.find((s) => s.id === picked) ?? STATES[0];

  const onPick = (id: Becoming) => {
    haptic.selection();
    setPicked(id);
    setAnswer('becoming', id);
  };

  const onContinue = () => {
    haptic.light();
    goto('contentType');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)' }}>
      <Glow intensity={0.12} />
      <TopBar onBack={() => goto('mirror')} center="03 · what should this become" />

      <div style={{ padding: '24px 28px 0' }}>
        <Eyebrow>— shift —</Eyebrow>
        <div style={{ height: 12 }} />
        <Display size={30}>From here,<br />what next?</Display>
      </div>

      <div style={{
        margin: '24px 28px', padding: '18px 20px',
        border: '1px solid rgba(200,76,43,0.4)',
        background: 'rgba(200,76,43,0.06)',
        borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--stone)',
        }}>
          now
        </div>
        <div style={{
          fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 17,
          color: 'var(--washi)', flex: 1,
        }}>
          carrying it
        </div>
        <div style={{
          flexShrink: 0, color: 'var(--persimmon)',
          fontFamily: 'var(--mono)', fontSize: 14,
          letterSpacing: '0.14em',
        }}>
          —→
        </div>
        <div style={{
          fontFamily: 'var(--jp)', fontSize: 24, color: 'var(--persimmon)',
          flexShrink: 0,
        }}>
          {choice.kanji}
        </div>
        <div style={{
          fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 17,
          color: 'var(--persimmon)', flexShrink: 0,
        }}>
          {choice.label.toLowerCase()}
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 280, bottom: 110, left: 0, right: 0,
        padding: '0 24px', overflowY: 'auto',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {STATES.map((s) => {
            const sel = s.id === picked;
            return (
              <button
                key={s.id}
                onClick={() => onPick(s.id)}
                style={{
                  appearance: 'none',
                  padding: '14px 8px',
                  background: sel ? 'rgba(200,76,43,0.12)' : 'rgba(244,239,230,0.025)',
                  border: sel ? '1px solid var(--persimmon)' : '1px solid rgba(244,239,230,0.08)',
                  borderRadius: 12,
                  color: 'var(--washi)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all 240ms var(--ease)',
                }}
              >
                <div style={{
                  fontFamily: 'var(--jp)', fontSize: 22,
                  color: sel ? 'var(--persimmon)' : 'var(--stone)',
                }}>
                  {s.kanji}
                </div>
                <div style={{
                  fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500,
                  color: sel ? 'var(--washi)' : 'rgba(244,239,230,0.85)',
                }}>
                  {s.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 36px' }}>
        <Btn full onClick={onContinue}>Build my ritual</Btn>
      </div>
    </div>
  );
}
