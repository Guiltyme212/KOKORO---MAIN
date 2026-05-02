import { useEffect, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import { Glow, TopBar } from '../components/atoms';
import type { ContentType } from '../types';

const DURATION_MS = 9000;

const TYPE_NAME: Record<ContentType, string> = {
  unwind: 'Unwind',
  attract: 'Attract',
  lockin: 'Lock In',
};

export function Composing({ goto }: { goto: (r: Route) => void }) {
  const { answers } = useAnswers();
  const [t, setT] = useState(0);
  const [phase, setPhase] = useState<0 | 1>(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (ts: number) => {
      const e = ts - start;
      setT(e / 1000);
      if (e >= DURATION_MS) {
        setPhase(1);
        haptic.success();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const progress = Math.min(1, (t * 1000) / DURATION_MS);
  const ctName = answers.contentType ? TYPE_NAME[answers.contentType] : 'Unwind';
  const becoming = answers.becoming || 'calm';

  const lines = [
    'Holding what you told me.',
    'Listening for the shape underneath.',
    `Softening the edges of ${becoming}.`,
    `Settling into ${ctName.toLowerCase()}.`,
    'Letting the voice find its breath.',
    'Almost ready.',
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)', overflow: 'hidden' }}>
      <Glow intensity={0.18} />
      <TopBar center="composing" />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingBottom: 260,
        transition: 'opacity 600ms var(--ease), transform 800ms var(--ease)',
        opacity: phase === 1 ? 0.65 : 1,
        transform: phase === 1 ? 'scale(0.78) translateY(-8px)' : 'scale(1)',
      }}>
        <div style={{ position: 'relative', width: 280, height: 280 }}>
          {phase !== 1 && [0, 1, 2, 3].map((r) => {
            const phase01 = ((t * 0.45) + r * 0.25) % 1;
            const scale = 0.55 + phase01 * 1.05;
            const alpha = (1 - phase01) * (0.18 + 0.18 * progress);
            return (
              <div
                key={r}
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div style={{
                  width: 200, height: 200, borderRadius: '50%',
                  border: `1px solid rgba(200,76,43,${alpha})`,
                  transform: `scale(${scale})`,
                }} />
              </div>
            );
          })}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--jp)', fontSize: 220, fontWeight: 400,
            color: 'var(--persimmon)',
            opacity: 0.32 + 0.55 * progress,
            transform: `scale(${1 + Math.sin(t * 1.1) * 0.04})`,
            filter: `drop-shadow(0 0 ${20 + 30 * progress}px rgba(200,76,43,${0.35 + 0.3 * progress}))`,
            userSelect: 'none',
            transition: 'opacity 400ms var(--ease)',
          }}>
            心
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 28, right: 28, bottom: 168,
        textAlign: 'center', minHeight: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: phase === 1 ? 0 : 1,
        transition: 'opacity 600ms var(--ease)',
      }}>
        {lines.map((l, i) => {
          const thresholds = [0, 0.16, 0.34, 0.52, 0.70, 0.92];
          let idx = 0;
          for (let k = 0; k < thresholds.length; k++) if (progress >= thresholds[k]) idx = k;
          const active = i === idx;
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: 0, right: 0,
                fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
                fontSize: 22, lineHeight: 1.35,
                color: 'var(--washi)',
                opacity: active ? 0.92 : 0,
                transform: active ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 900ms var(--ease), transform 900ms var(--ease)',
                letterSpacing: 0.1,
                padding: '0 16px',
              }}
            >
              {l}
            </div>
          );
        })}
      </div>

      {phase === 1 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 56,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          animation: 'v2pop 700ms var(--ease) both',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9.5,
            letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'var(--persimmon)',
          }}>
            — ready when you are —
          </div>
          <button
            onClick={() => { haptic.medium(); goto('player'); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 14,
              padding: '14px 28px 14px 18px', borderRadius: 100,
              background: 'var(--persimmon)', color: 'var(--washi)',
              boxShadow: '0 0 60px rgba(200,76,43,0.45)',
              fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18,
              letterSpacing: -0.1,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: 16,
              background: 'rgba(0,0,0,0.18)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="11" height="12" viewBox="0 0 13 14" fill="currentColor">
                <polygon points="2,1 2,13 12,7" />
              </svg>
            </span>
            Help me settle
          </button>
          <style>{`@keyframes v2pop { from { opacity: 0; transform: translateY(12px); } }`}</style>
        </div>
      )}
    </div>
  );
}
