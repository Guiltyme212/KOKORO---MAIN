import { useEffect, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnimationTime } from '../lib/hooks';
import { haptic } from '../lib/telegram';

const ROTATING_WORDS = ['kokoro', 'heart', 'mind', 'spirit'] as const;
const WORD_HOLD_MS = 5200;
const WORD_FADE_MS = 1100;
const WORD_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

function CyclingWord() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    let swap: ReturnType<typeof setTimeout> | undefined;
    const tick = setInterval(() => {
      setPhase('out');
      swap = setTimeout(() => {
        setIdx(i => (i + 1) % ROTATING_WORDS.length);
        setPhase('in');
      }, WORD_FADE_MS);
    }, WORD_HOLD_MS);
    return () => {
      clearInterval(tick);
      if (swap) clearTimeout(swap);
    };
  }, []);

  return (
    <span style={{
      display: 'inline-grid',
      verticalAlign: 'baseline',
      lineHeight: 'inherit',
    }}>
      {ROTATING_WORDS.map((w, i) => {
        const isActive = i === idx;
        const visible = isActive && phase === 'in';
        const transform = visible
          ? 'translateY(0)'
          : isActive
            ? 'translateY(-12px)'
            : 'translateY(12px)';
        return (
          <span
            key={w}
            aria-hidden={!visible}
            style={{
              gridArea: '1 / 1',
              whiteSpace: 'nowrap',
              opacity: visible ? 1 : 0,
              transform,
              filter: visible ? 'blur(0)' : 'blur(4px)',
              letterSpacing: visible ? 0 : '0.04em',
              transition: [
                `opacity ${WORD_FADE_MS}ms ${WORD_EASE}`,
                `transform ${WORD_FADE_MS}ms ${WORD_EASE}`,
                `filter ${WORD_FADE_MS}ms ${WORD_EASE}`,
                `letter-spacing ${WORD_FADE_MS}ms ${WORD_EASE}`,
              ].join(', '),
              willChange: 'opacity, transform, filter',
            }}
          >
            {w}
          </span>
        );
      })}
    </span>
  );
}

export function Welcome({ goto }: { goto: (r: Route) => void }) {
  const t = useAnimationTime();
  const [hover, setHover] = useState(false);

  // slow meditative breath: -1..1, eased so peaks linger
  const pulseRaw = Math.sin(t * 0.42);
  const pulse = Math.sign(pulseRaw) * Math.pow(Math.abs(pulseRaw), 0.7);
  const pulseN = (pulse + 1) / 2;                         // 0..1
  const pulseOpacity = 0.55 + pulseN * 0.45;              // 0.55..1.00
  const pulseScale = 1 + pulse * 0.022;                    // 0.978..1.022
  const haloOpacity = 0.10 + pulseN * 0.30;               // 0.10..0.40
  const haloScale = 1 + pulse * 0.05;
  const drift = Math.sin(t * 0.22) * 3;

  const onBegin = () => {
    haptic.light();
    goto('name');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)', overflow: 'hidden' }}>
      {/* faint floor glow at the bottom */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(40% 28% at 50% 100%, rgba(200,76,43,0.10) 0%, transparent 70%)',
      }} />

      {/* breathing 心 with soft pulsing halo */}
      <div style={{
        position: 'absolute', top: 200, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* soft halo that breathes with the pulse — no blur for clarity */}
          <div style={{
            position: 'absolute',
            width: 280, height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,76,43,0.28) 0%, rgba(200,76,43,0.04) 45%, transparent 72%)',
            opacity: haloOpacity,
            transform: `scale(${haloScale}) translateY(${drift}px)`,
            willChange: 'opacity, transform',
          }} />
          {/* the 心 itself — clean, no harsh textShadow */}
          <div style={{
            position: 'relative',
            fontFamily: 'var(--jp)', fontWeight: 300,
            fontSize: 180, lineHeight: 1,
            color: 'var(--persimmon)',
            opacity: pulseOpacity,
            transform: `scale(${pulseScale}) translateY(${drift}px)`,
            userSelect: 'none',
          }}>
            心
          </div>
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
          <span>heart · mind · spirit</span>
          <span style={{ width: 18, height: 1, background: 'rgba(244,239,230,0.18)' }} />
        </div>
      </div>

      {/* center column */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '0 28px 140px', zIndex: 5,
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
          <span style={{ color: 'var(--persimmon)' }}><CyclingWord /></span> holding?
        </h1>
      </div>

      {/* Begin button pinned to bottom */}
      <div style={{
        position: 'absolute', bottom: 56, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        zIndex: 5,
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
      </div>

    </div>
  );
}
