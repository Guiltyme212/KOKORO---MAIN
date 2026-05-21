import { useEffect, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import { Glow, TopBar, Eyebrow, Btn } from '../components/atoms';
import { kickoffAllMeditations } from '../state/meditationProgress';

const HIGHLIGHTS = ['anger', 'pressure', 'effort'];

const FALLBACK_REFLECTION =
  'You are not being dramatic. You are carrying anger, pressure, and the feeling that nobody really saw how much effort you put in today.';

export function Mirror({ goto }: { goto: (r: Route) => void }) {
  const { answers } = useAnswers();
  const reflection = (answers.carry && answers.carry.length > 32)
    ? `What I heard: ${answers.carry.replace(/\s+/g, ' ').trim()}`
    : FALLBACK_REFLECTION;

  // responsive serif size — long reflections shrink slightly, but stay generous
  const reflectionFontSize =
    reflection.length > 170 ? 22 :
    reflection.length > 120 ? 24 :
    reflection.length > 70  ? 26 :
    28;

  const [reveal, setReveal] = useState(0);
  useEffect(() => {
    const ts = [400, 1000, 1700, 2400].map((d, i) =>
      window.setTimeout(() => setReveal(i + 1), d),
    );
    return () => ts.forEach(window.clearTimeout);
  }, []);

  const advance = () => {
    haptic.light();
    kickoffAllMeditations(answers, answers.vibe || 'zen');
    goto('composing');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)' }}>
      <style>{`
        .mirror-reflection {
          scrollbar-width: thin;
          scrollbar-color: rgba(200,76,43,0.4) transparent;
          scroll-behavior: smooth;
          overscroll-behavior: contain;
        }
        .mirror-reflection::-webkit-scrollbar { width: 3px; }
        .mirror-reflection::-webkit-scrollbar-track { background: transparent; }
        .mirror-reflection::-webkit-scrollbar-thumb {
          background: rgba(200,76,43,0.35);
          border-radius: 4px;
          transition: background 220ms var(--ease);
        }
        .mirror-reflection:hover::-webkit-scrollbar-thumb { background: rgba(200,76,43,0.6); }
      `}</style>
      <Glow intensity={0.10} />
      <TopBar onBack={() => goto('contentType')} center="02 · what kokoro heard" />

      <div style={{
        position: 'absolute', top: 120, bottom: 132, left: 0, right: 0,
        padding: '0 28px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', top: 8, right: 16,
          fontFamily: 'var(--jp)', fontSize: 220, lineHeight: 1,
          color: 'var(--persimmon)', opacity: 0.06,
          pointerEvents: 'none',
        }}>
          感
        </div>

        <div style={{
          opacity: reveal >= 1 ? 1 : 0,
          transform: reveal >= 1 ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 700ms var(--ease)',
        }}>
          <Eyebrow>— mirror —</Eyebrow>
        </div>
        <div style={{ height: 18 }} />

        <p
          className="mirror-reflection"
          style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
            fontSize: reflectionFontSize, lineHeight: 1.35, letterSpacing: -0.3,
            margin: 0, color: 'var(--washi)', textWrap: 'pretty',
            maxHeight: 380, overflowY: 'auto',
            paddingRight: 12,
            // soft fade at top + bottom so scrollable content dissolves cleanly
            maskImage:
              'linear-gradient(to bottom, transparent 0, #000 22px, #000 calc(100% - 32px), transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0, #000 22px, #000 calc(100% - 32px), transparent 100%)',
          }}
        >
          {reflection.split(' ').map((w, i) => {
            const lower = w.toLowerCase();
            const isHighlight = HIGHLIGHTS.some((k) => lower.includes(k));
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block', marginRight: 6,
                  opacity: reveal >= 2 ? 1 : 0,
                  transform: reveal >= 2 ? 'translateY(0)' : 'translateY(6px)',
                  transition: `all 600ms var(--ease) ${i * 30}ms`,
                  color: isHighlight ? 'var(--persimmon)' : 'inherit',
                }}
              >
                {w}
              </span>
            );
          })}
        </p>

        <div style={{
          marginTop: 36,
          opacity: reveal >= 3 ? 1 : 0,
          transition: 'opacity 800ms var(--ease)',
          display: 'flex', gap: 10, alignItems: 'center',
          fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--stone)',
        }}>
          <span style={{ width: 18, height: 1, background: 'var(--persimmon)', opacity: 0.6 }} />
          <span>Did I hear you?</span>
        </div>

        <div style={{
          marginTop: 14, display: 'flex', gap: 8,
          opacity: reveal >= 3 ? 1 : 0,
          transition: 'opacity 800ms var(--ease) 200ms',
        }}>
          {(['Yes', 'Softer', 'Sharper', 'Try again'] as const).map((label, i) => (
            <button
              key={label}
              onClick={() => label === 'Try again' ? goto('capture') : advance()}
              style={{
                padding: '10px 14px', borderRadius: 100,
                background: i === 0 ? 'rgba(200,76,43,0.15)' : 'transparent',
                border: i === 0 ? '1px solid var(--persimmon)' : '1px solid rgba(244,239,230,0.18)',
                color: i === 0 ? 'var(--persimmon)' : 'rgba(244,239,230,0.78)',
                fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500,
                letterSpacing: 0.4,
                transition: 'all 240ms var(--ease)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 36px' }}>
        <Btn full onClick={advance}>Create a meditation for me</Btn>
      </div>
    </div>
  );
}
