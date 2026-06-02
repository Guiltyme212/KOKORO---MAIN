import { useEffect, useRef, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnimationTime } from '../lib/hooks';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import { Glow, TopBar, Eyebrow, Display, Btn } from '../components/atoms';

const SUGGESTIONS = ['Love', 'Babe', 'Honey', 'Baby', 'Sweetheart', 'Sunshine', 'Kitten'];

export function Name({ goto }: { goto: (r: Route) => void }) {
  const { answers, setAnswer } = useAnswers();
  const [pick, setPick] = useState<string | null>(answers.callMe || null);
  const [custom, setCustom] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [realName, setRealName] = useState(answers.realName ?? '');

  const customRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const t = useAnimationTime();
  const breath = 0.7 + Math.sin(t * 0.6) * 0.08;

  useEffect(() => {
    if (customMode) setTimeout(() => customRef.current?.focus(), 80);
  }, [customMode]);

  const choose = (val: string) => {
    haptic.selection();
    setPick(val);
    setCustomMode(false);
    setCustom('');
  };
  const enterCustom = () => {
    setCustomMode(true);
    setPick(null);
  };

  const trimmedRealName = realName.trim();
  const trimmedCustom = custom.trim();
  const finalCallMe =
    customMode && trimmedCustom ? trimmedCustom : pick && pick !== '__name__' ? pick : '';
  const valid = trimmedRealName.length > 0 || finalCallMe.length > 0;

  const onContinue = () => {
    setAnswer('realName', trimmedRealName || undefined);
    setAnswer('callMe', finalCallMe);
    haptic.light();
    goto('capture');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)', overflow: 'hidden' }}>
      <Glow intensity={0.13} />
      <TopBar onBack={() => goto('welcome')} center="how to call you" />

      {/* breathing 心 in upper-right negative space */}
      <div style={{
        position: 'absolute', top: 92, right: -40,
        fontFamily: 'var(--jp)', fontWeight: 300,
        fontSize: 220, lineHeight: 1, color: 'var(--persimmon)',
        opacity: breath * 0.10, pointerEvents: 'none', userSelect: 'none',
      }}>
        心
      </div>

      <div style={{
        position: 'absolute', top: 132, left: 0, right: 0, bottom: 24,
        padding: '0 28px',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <Eyebrow>— how to call you —</Eyebrow>
        <div style={{ height: 18 }} />
        <Display size={40}>
          What should<br />I call you?
        </Display>
        <p style={{
          marginTop: 16, marginBottom: 0,
          fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
          fontSize: 16, lineHeight: 1.45, color: 'rgba(244,239,230,0.55)',
          textWrap: 'balance', maxWidth: 300,
        }}>
          Your name grounds the moment. The softer one wraps it.
        </p>

        {/* Real name — always visible */}
        <div style={{ marginTop: 28, position: 'relative' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9.5,
            letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'rgba(244,239,230,0.45)', marginBottom: 8,
          }}>
            — your name (optional) —
          </div>
          <input
            ref={nameRef}
            value={realName}
            onChange={(e) => setRealName(e.target.value.slice(0, 32))}
            onKeyDown={(e) => e.key === 'Enter' && valid && onContinue()}
            placeholder="first name…"
            style={{
              width: '100%', color: 'var(--washi)',
              fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
              fontSize: 26, padding: '6px 0',
              letterSpacing: -0.4, lineHeight: 1.3,
              caretColor: 'var(--persimmon)',
            }}
          />
          <div style={{
            height: 1,
            background: trimmedRealName
              ? 'linear-gradient(90deg, rgba(200,76,43,0.7), rgba(200,76,43,0.1))'
              : 'linear-gradient(90deg, rgba(244,239,230,0.25), transparent)',
            transition: 'background 240ms',
          }} />
        </div>

        {/* Endearment chips + custom */}
        <div style={{
          marginTop: 26, marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 14,
          fontFamily: 'var(--mono)', fontSize: 9.5,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(244,239,230,0.32)',
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(244,239,230,0.1)' }} />
          and something softer
          <div style={{ flex: 1, height: 1, background: 'rgba(244,239,230,0.1)' }} />
        </div>

        {customMode ? (
          <div style={{ position: 'relative' }}>
            <input
              ref={customRef}
              value={custom}
              onChange={(e) => setCustom(e.target.value.slice(0, 24))}
              onKeyDown={(e) => e.key === 'Enter' && valid && onContinue()}
              placeholder="type a soft one…"
              style={{
                width: '100%', color: 'var(--washi)',
                fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
                fontSize: 24, padding: '10px 0',
                letterSpacing: -0.4, lineHeight: 1.3,
                caretColor: 'var(--persimmon)',
              }}
            />
            <div style={{
              height: 1,
              background: custom
                ? 'linear-gradient(90deg, rgba(200,76,43,0.7), rgba(200,76,43,0.1))'
                : 'linear-gradient(90deg, rgba(244,239,230,0.25), transparent)',
              transition: 'background 240ms',
            }} />
            <button
              onClick={() => { setCustomMode(false); setCustom(''); }}
              style={{
                position: 'absolute', right: 0, top: 12,
                color: 'var(--stone)',
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map((s) => {
              const active = pick === s;
              return (
                <button
                  key={s}
                  onClick={() => choose(s)}
                  style={{
                    background: active ? 'var(--persimmon)' : 'rgba(244,239,230,0.04)',
                    border: `1px solid ${active ? 'var(--persimmon)' : 'rgba(244,239,230,0.14)'}`,
                    color: active ? 'var(--washi)' : 'rgba(244,239,230,0.92)',
                    fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400,
                    fontSize: 17, letterSpacing: -0.1,
                    padding: '10px 18px', borderRadius: 100,
                    transition: 'all 220ms var(--ease)',
                  }}
                >
                  {s}
                </button>
              );
            })}

            <button
              onClick={enterCustom}
              style={{
                background: 'transparent',
                border: '1px dashed rgba(244,239,230,0.28)',
                color: 'var(--stone)',
                fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: '0.2em', textTransform: 'uppercase',
                padding: '10px 16px', borderRadius: 100,
                transition: 'all 220ms var(--ease)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1, marginTop: -2 }}>+</span> Your own
            </button>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 24 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
          <Btn onClick={onContinue}>{valid ? 'Continue →' : 'Skip for now'}</Btn>
          <div style={{
            flex: 1,
            fontFamily: 'var(--mono)', fontSize: 9,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'rgba(244,239,230,0.32)', textAlign: 'right',
            lineHeight: 1.4,
          }}>
            you can change this<br />any time
          </div>
        </div>
      </div>
    </div>
  );
}
