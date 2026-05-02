import { Fragment, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnimationTime } from '../lib/hooks';
import { haptic } from '../lib/telegram';

const AMBIENT_KANJI = [
  { ch: '感', x: 12, y: 18, size: 64, delay: 0,   rot: -4 },
  { ch: '思', x: 78, y: 26, size: 52, delay: 1.4, rot:  2 },
  { ch: '志', x: 18, y: 70, size: 56, delay: 2.7, rot:  3 },
  { ch: '静', x: 80, y: 74, size: 48, delay: 0.7, rot: -2 },
  { ch: '夢', x: 50, y: 12, size: 36, delay: 2.0, rot:  1 },
  { ch: '道', x: 86, y: 50, size: 32, delay: 1.1, rot: -3 },
  { ch: '光', x:  8, y: 46, size: 30, delay: 3.2, rot:  4 },
];

const PILLARS = [
  { kanji: '感', en: 'Heart'  },
  { kanji: '思', en: 'Mind'   },
  { kanji: '志', en: 'Spirit' },
];

export function Welcome({ goto }: { goto: (r: Route) => void }) {
  const t = useAnimationTime();
  const [hover, setHover] = useState(false);

  const breath = 0.86 + Math.sin(t * 0.6) * 0.08;
  const drift = Math.sin(t * 0.25) * 6;

  const onBegin = () => {
    haptic.light();
    goto('name');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)', overflow: 'hidden' }}>
      {/* ambient persimmon glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(60% 50% at 50% 45%, rgba(200,76,43,0.18) 0%, transparent 65%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(40% 30% at 50% 100%, rgba(200,76,43,0.12) 0%, transparent 70%)',
      }} />

      {/* ambient floating kanji */}
      {AMBIENT_KANJI.map((a, i) => {
        const float = Math.sin(t * 0.4 + a.delay) * 6;
        const fade = 0.04 + 0.04 * Math.sin(t * 0.3 + a.delay);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${a.x}%`, top: `${a.y}%`,
              fontFamily: 'var(--jp)', fontWeight: 300,
              fontSize: a.size, lineHeight: 1,
              color: `rgba(244,239,230,${0.08 + fade})`,
              transform: `translate(-50%,-50%) translateY(${float}px) rotate(${a.rot}deg)`,
              userSelect: 'none', pointerEvents: 'none',
            }}
          >
            {a.ch}
          </div>
        );
      })}

      {/* huge breathing 心 */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', contain: 'strict',
      }}>
        <div style={{
          fontFamily: 'var(--jp)', fontWeight: 300,
          fontSize: 340, lineHeight: 1,
          color: 'var(--persimmon)',
          opacity: breath * 0.26,
          transform: `translateY(${drift}px)`,
          textShadow: '0 0 60px rgba(200,76,43,0.45)',
          userSelect: 'none',
        }}>
          心
        </div>
      </div>

      {/* top wordmark */}
      <div style={{
        position: 'absolute', top: 60, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        zIndex: 5,
      }}>
        <div style={{
          fontFamily: 'var(--serif)', fontWeight: 300,
          fontSize: 34, lineHeight: 1,
          letterSpacing: '0.42em', textTransform: 'uppercase',
          color: 'var(--washi)',
          paddingLeft: '0.42em',
          textShadow: '0 2px 30px rgba(0,0,0,0.5)',
        }}>
          KOKORO
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--mono)', fontSize: 9,
          letterSpacing: '0.32em', textTransform: 'uppercase',
          color: 'var(--stone)',
        }}>
          <span style={{ width: 18, height: 1, background: 'rgba(244,239,230,0.18)' }} />
          <span>心 · the heart-mind</span>
          <span style={{ width: 18, height: 1, background: 'rgba(244,239,230,0.18)' }} />
        </div>
      </div>

      {/* center column */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 28px', zIndex: 5,
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'var(--persimmon)', marginBottom: 18,
          textAlign: 'center',
        }}>
          — Welcome —
        </div>

        <h1 style={{
          fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
          fontSize: 48, lineHeight: 1.05, letterSpacing: -1.4,
          margin: 0, color: 'var(--washi)', textAlign: 'center',
          textWrap: 'balance',
          textShadow: '0 2px 30px rgba(0,0,0,0.6)',
        }}>
          What is your<br />
          <span style={{ color: 'var(--persimmon)' }}>kokoro holding?</span>
        </h1>

        <p style={{
          fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
          fontSize: 16.5, lineHeight: 1.55,
          color: 'rgba(244,239,230,0.7)',
          margin: '40px auto 0', maxWidth: 320,
          textAlign: 'center', textWrap: 'balance',
        }}>
          Speak it, type it, or just let go. We'll build tonight's ritual around it.
        </p>

        {/* three-pillar legend */}
        <div style={{
          marginTop: 40,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        }}>
          {PILLARS.map((p, i) => (
            <Fragment key={p.en}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                width: 78,
              }}>
                <div style={{
                  fontFamily: 'var(--jp)', fontWeight: 300,
                  fontSize: 30, lineHeight: 1,
                  color: 'var(--persimmon)',
                  textShadow: '0 0 18px rgba(200,76,43,0.35)',
                }}>
                  {p.kanji}
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 9,
                  letterSpacing: '0.28em', textTransform: 'uppercase',
                  color: 'rgba(244,239,230,0.78)',
                }}>
                  {p.en}
                </div>
              </div>
              {i < PILLARS.length - 1 && (
                <div style={{
                  width: 16, height: 1, marginTop: 14,
                  background: 'rgba(244,239,230,0.18)',
                }} />
              )}
            </Fragment>
          ))}
        </div>

        <div style={{
          marginTop: 32,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}>
          <button
            onClick={onBegin}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              position: 'relative',
              background: hover ? 'var(--washi)' : 'transparent',
              color: hover ? 'var(--sumi)' : 'var(--washi)',
              border: '1px solid rgba(244,239,230,0.85)',
              padding: '16px 56px',
              fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500,
              letterSpacing: '0.36em', textTransform: 'uppercase',
              transition: 'all 280ms var(--ease)',
              borderRadius: 100,
              backdropFilter: 'blur(6px)',
              boxShadow: hover
                ? '0 14px 40px rgba(244,239,230,0.18)'
                : '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            Begin
          </button>

          <button
            onClick={() => goto('quickReset')}
            style={{
              color: 'var(--stone)',
              fontFamily: 'var(--mono)', fontSize: 9.5,
              letterSpacing: '0.28em', textTransform: 'uppercase',
              padding: '4px 8px',
            }}
          >
            No story · just reset me
          </button>
        </div>
      </div>

      {/* footer */}
      <div style={{
        position: 'absolute', bottom: 28, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        zIndex: 5,
      }}>
        <div style={{ width: 28, height: 1, background: 'rgba(244,239,230,0.25)' }} />
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--stone)',
        }}>
          Takes 90 seconds · Private
        </div>
      </div>
    </div>
  );
}
