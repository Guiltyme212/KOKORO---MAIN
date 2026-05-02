import { useEffect, useMemo, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnimationTime } from '../lib/hooks';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import { Glow, TopBar, Eyebrow, Display } from '../components/atoms';
import type { ContentType } from '../types';

const META: Record<ContentType, { tag: string; name: string; mins: number; kanji: string }> = {
  unwind:  { tag: '心 · Unwind',  name: 'Vent. Then breathe.',     mins: 5, kanji: '心' },
  attract: { tag: '未 · Attract', name: 'A Tuesday in Amsterdam.', mins: 7, kanji: '未' },
  lockin:  { tag: '志 · Lock In', name: 'One rep of being him.',   mins: 4, kanji: '志' },
};

const SCENE_LINES = [
  'You wake up in your apartment in Amsterdam.',
  'The room is quiet because your systems are running.',
  'You check the dashboard. Revenue came in overnight.',
  "You're not shocked. This is normal now.",
  'You stand up. Light through the window.',
  'Today is Tuesday. You know exactly what to do.',
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Player({ goto }: { goto: (r: Route) => void }) {
  const { answers } = useAnswers();
  const ct: ContentType = answers.contentType || 'unwind';
  const becoming = answers.becoming || 'calm';
  const isCinematic = ct === 'attract';

  const meta = META[ct];
  const TOTAL = meta.mins * 60;

  const [elapsed, setElapsed] = useState(Math.round(TOTAL * 0.18));
  const [playing, setPlaying] = useState(true);
  const t = useAnimationTime();

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setElapsed((e) => Math.min(TOTAL, e + 1)), 1000);
    return () => clearInterval(id);
  }, [playing, TOTAL]);

  const progress = elapsed / TOTAL;
  const visibleScene = SCENE_LINES.filter((_, i) => progress > (i / SCENE_LINES.length) * 0.95);

  const bars = useMemo(() => {
    const v: number[] = [];
    let seed = 11;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 80; i++) {
      const env = Math.sin((i / 80) * Math.PI) * 0.6 + 0.4;
      v.push(env * (0.3 + rnd() * 0.7));
    }
    return v;
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)', overflow: 'hidden' }}>
      {isCinematic ? (
        <>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(80% 60% at 50% 30%, rgba(200,76,43,0.25) 0%, rgba(200,76,43,0.08) 35%, transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(200,76,43,0.06) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.6) 100%)',
          }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '46%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(200,76,43,0.5), transparent)',
            opacity: 0.7,
          }} />
        </>
      ) : (
        <Glow intensity={ct === 'lockin' ? 0.22 : 0.10} />
      )}

      <TopBar
        onBack={() => goto('contentType')}
        center={meta.tag}
        right={<div style={{ fontFamily: 'var(--jp)', fontSize: 16, color: 'var(--persimmon)' }}>心</div>}
      />

      <div style={{
        position: 'absolute', top: 130, left: 0, right: 0, bottom: 260,
        padding: '0 28px',
        display: 'flex', flexDirection: 'column',
      }}>
        {isCinematic ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Eyebrow>— scene —</Eyebrow>
            <div style={{ height: 16 }} />
            <div style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
              fontSize: 26, lineHeight: 1.4, color: 'var(--washi)',
              minHeight: 220, textWrap: 'pretty',
            }}>
              {visibleScene.map((l, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 14,
                    opacity: i === visibleScene.length - 1 ? 1 : 0.45,
                    animation: 'v2line 700ms var(--ease) both',
                    transition: 'opacity 700ms var(--ease)',
                  }}
                >
                  {l}
                </div>
              ))}
            </div>
            <style>{`@keyframes v2line { from { opacity: 0; transform: translateY(8px); } }`}</style>
          </div>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            alignItems: 'center', gap: 32,
          }}>
            <div style={{
              fontFamily: 'var(--jp)', fontSize: 200, lineHeight: 1, color: 'var(--persimmon)',
              opacity: 0.18 + 0.06 * Math.sin(t * 0.8),
              filter: 'drop-shadow(0 0 30px rgba(200,76,43,0.4))',
              transform: `scale(${1 + 0.02 * Math.sin(t * 0.6)})`,
              userSelect: 'none',
            }}>
              {meta.kanji}
            </div>
            <div style={{ textAlign: 'center' }}>
              <Display size={26}>{meta.name}</Display>
              <div style={{
                marginTop: 10,
                fontFamily: 'var(--mono)', fontSize: 10.5,
                letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--stone)',
              }}>
                toward {becoming}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 28px 36px' }}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 2, marginBottom: 12 }}>
          {bars.map((v, i) => {
            const barP = i / bars.length;
            const played = barP <= progress;
            const isHead = Math.abs(barP - progress) < 1.5 / bars.length;
            const mod = playing && played ? 1 + 0.12 * Math.sin(t * 3 + i * 0.5) : 1;
            const h = Math.max(2, v * 40 * mod);
            return (
              <div
                key={i}
                style={{
                  flex: 1, height: `${h}px`, borderRadius: 0.5,
                  background: played ? 'var(--persimmon)' : 'var(--stone)',
                  opacity: played ? (isHead ? 1 : 0.92) : 0.22,
                  boxShadow: isHead ? '0 0 8px rgba(200,76,43,0.7)' : 'none',
                }}
              />
            );
          })}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1, color: 'var(--stone)',
          marginBottom: 18,
        }}>
          <span>{fmt(elapsed)}</span>
          <span>−{fmt(TOTAL - elapsed)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
          <button
            style={{
              color: 'var(--stone)',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1,
              padding: 8,
            }}
            onClick={() => { haptic.light(); setElapsed((e) => Math.max(0, e - 15)); }}
          >
            −15s
          </button>
          <button
            onClick={() => { haptic.medium(); setPlaying((p) => !p); }}
            style={{
              width: 78, height: 78, borderRadius: '50%',
              background: 'var(--persimmon)', color: 'var(--washi)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 50px rgba(200,76,43,0.35)',
            }}
          >
            {playing ? (
              <svg width="22" height="24" viewBox="0 0 22 24" fill="currentColor">
                <rect x="4" y="2" width="5" height="20" rx="0.5" />
                <rect x="13" y="2" width="5" height="20" rx="0.5" />
              </svg>
            ) : (
              <svg width="24" height="26" viewBox="0 0 24 26" fill="currentColor">
                <polygon points="5,2 5,24 22,13" />
              </svg>
            )}
          </button>
          <button
            style={{
              color: 'var(--stone)',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1,
              padding: 8,
            }}
            onClick={() => { haptic.light(); setElapsed((e) => Math.min(TOTAL, e + 15)); }}
          >
            +15s
          </button>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => goto('reflect')}
            style={{
              color: 'var(--stone)', fontFamily: 'var(--mono)', fontSize: 10,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              padding: 8,
            }}
          >
            End →
          </button>
          <button
            style={{
              color: 'var(--persimmon)', fontFamily: 'var(--sans)', fontSize: 12,
              letterSpacing: 0.3, padding: 8,
            }}
          >
            Save to library
          </button>
        </div>
      </div>
    </div>
  );
}
