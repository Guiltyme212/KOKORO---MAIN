import { useEffect, useState } from 'react';
import type { Route } from '../lib/router';
import { TopBar } from '../components/atoms';

type Job = {
  id: string;
  voice: string;
  desc: string;
  duration: string;
  kanji: string;
  color: string;
  total: number;
  yours?: boolean;
};

const JOBS: Job[] = [
  { id: 'j1', voice: 'Brad',  desc: 'grounded · cinematic', duration: '7:12', kanji: '感', color: '#c84c2b', total: 9.0,  yours: true },
  { id: 'j2', voice: 'Clara', desc: 'close · confiding',    duration: '6:48', kanji: '静', color: '#d4a36a', total: 11.0 },
  { id: 'j3', voice: 'Koji',  desc: 'spare · deliberate',   duration: '8:04', kanji: '空', color: '#7a8e6a', total: 13.5 },
  { id: 'j4', voice: 'Maren', desc: 'bright · kind',        duration: '5:50', kanji: '光', color: '#e6b85c', total: 7.5 },
];

const TITLES = [
  "You're allowed to put it down.",
  'What today actually was.',
  'The version of you that knew.',
  'Soft landing into calm.',
];

const PAST = [
  { day: 'Yesterday', kanji: '未', skin: 'future',    name: 'A Tuesday in Amsterdam.',                  word: 'real',   mins: 7 },
  { day: 'Yesterday', kanji: '志', skin: 'lockin',    name: 'Stop negotiating with the smaller you.',   word: 'sharp',  mins: 4 },
  { day: 'Sun',       kanji: '感', skin: 'aftercare', name: 'Nobody saw the effort. I did.',            word: 'seen',   mins: 6 },
  { day: 'Sat',       kanji: '夜', skin: 'aftercare', name: "Tonight's reset.",                         word: 'soft',   mins: 8 },
  { day: 'Fri',       kanji: '志', skin: 'lockin',    name: 'One rep of being him.',                    word: 'ready',  mins: 5 },
];

// Stage label tracks the real backend pipeline phases:
// writing (LLM) → voicing (Suno gen) → mastering (Suno finalize) → ready.
function stageLabel(p: number): string {
  if (p >= 1)    return 'ready';
  if (p >= 0.72) return 'mastering';
  if (p >= 0.32) return 'voicing';
  return 'writing';
}

function PlayIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden>
      <polygon points="2,1 2,8 8,4.5" fill="var(--persimmon)" />
    </svg>
  );
}

export function PickWhatLands({ goto }: { goto: (r: Route) => void }) {
  const [progress, setProgress] = useState<Record<string, number>>(
    () => Object.fromEntries(JOBS.map((j) => [j.id, 0])),
  );
  const [t, setT] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const loop = (ts: number) => {
      const elapsed = (ts - start) / 1000;
      setT(elapsed);
      const next: Record<string, number> = {};
      JOBS.forEach((j) => {
        // ease-out so the first 70% is fast, the last bit lingers — mirrors
        // realistic TTS rendering where mastering is the long tail.
        const raw = Math.min(1, elapsed / j.total);
        next[j.id] = 1 - Math.pow(1 - raw, 1.6);
      });
      setProgress(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const readyCount = JOBS.filter((j) => (progress[j.id] ?? 0) >= 1).length;
  const allReady = readyCount === JOBS.length;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)' }}>
      <TopBar onBack={() => goto('welcome')} center="library" />

      <div style={{
        position: 'absolute', top: 96, bottom: 24, left: 0, right: 0,
        overflowY: 'auto',
      }}>
        {/* HERO */}
        <div style={{ padding: '0 24px' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            letterSpacing: '0.28em', textTransform: 'uppercase',
            color: allReady ? 'var(--persimmon)' : 'var(--stone)',
            transition: 'color 320ms var(--ease)',
          }}>
            {allReady
              ? '— ready · pick one —'
              : `— composing · ${readyCount} of ${JOBS.length} ready —`}
          </div>

          <div style={{ height: 12 }} />

          <h1 style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
            fontSize: 28, lineHeight: 1.05, letterSpacing: -0.7,
            margin: 0, color: 'var(--washi)',
            textWrap: 'balance',
          }}>
            {allReady
              ? <>Four ways in.<br />Pick what lands.</>
              : <>Kokoro is making<br />four for you.</>}
          </h1>

          <div style={{
            marginTop: 10,
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
            fontSize: 14, lineHeight: 1.45,
            color: 'rgba(244,239,230,0.55)',
            maxWidth: 320, textWrap: 'balance',
          }}>
            {allReady
              ? 'Different voices. Same care. Tap any one to begin.'
              : 'Different voices, different rhythms. The one that lands is yours.'}
          </div>
        </div>

        {/* CARDS */}
        <div style={{ marginTop: 18, padding: '0 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {JOBS.map((j, i) => {
              const p = progress[j.id] ?? 0;
              const ready = p >= 1;
              const pct = Math.round(p * 100);
              const pulse = ready ? 1 : Math.sin(t * 1.6 + i) * 0.15 + 0.85;
              const stage = stageLabel(p);

              const borderColor = ready
                ? 'rgba(200,76,43,0.4)'
                : j.yours
                  ? 'rgba(200,76,43,0.32)'
                  : 'rgba(244,239,230,0.08)';

              return (
                <button
                  key={j.id}
                  onClick={ready ? () => goto('player') : undefined}
                  disabled={!ready}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    appearance: 'none',
                    background: ready ? 'rgba(200,76,43,0.06)' : 'rgba(244,239,230,0.025)',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 12,
                    padding: '14px',
                    textAlign: 'left',
                    cursor: ready ? 'pointer' : 'default',
                    transition: 'all 240ms var(--ease)',
                    minHeight: 132,
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--washi)',
                  }}
                >
                  <div aria-hidden style={{
                    position: 'absolute',
                    top: -8, right: -4,
                    fontFamily: 'var(--jp)', fontWeight: 300,
                    fontSize: 64, lineHeight: 1,
                    color: j.color,
                    opacity: ready ? 0.18 : pulse * 0.10,
                    transition: 'opacity 400ms',
                    pointerEvents: 'none',
                  }}>
                    {j.kanji}
                  </div>

                  {j.yours && (
                    <div style={{
                      position: 'absolute',
                      top: 14, right: 14,
                      fontFamily: 'var(--mono)', fontSize: 8,
                      letterSpacing: '0.24em', textTransform: 'uppercase',
                      color: 'rgba(200,76,43,0.75)',
                    }}>
                      yours
                    </div>
                  )}

                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 9,
                    letterSpacing: '0.22em', textTransform: 'uppercase',
                    color: ready ? 'var(--persimmon)' : 'rgba(244,239,230,0.4)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: ready ? 'var(--persimmon)' : 'rgba(244,239,230,0.4)',
                      opacity: ready ? 1 : pulse,
                      transition: 'opacity 240ms',
                    }} />
                    {ready ? 'ready' : `${pct}%`}
                  </div>

                  <div style={{
                    marginTop: 6,
                    fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400,
                    fontSize: 16, color: 'var(--washi)', letterSpacing: -0.2,
                  }}>
                    {j.voice}
                  </div>

                  <div style={{
                    marginTop: 1,
                    fontFamily: 'var(--mono)', fontSize: 9,
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: 'var(--stone)',
                  }}>
                    {j.desc}
                  </div>

                  <div style={{
                    marginTop: 8,
                    fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
                    fontSize: 12.5, lineHeight: 1.3,
                    color: ready ? 'rgba(244,239,230,0.78)' : 'rgba(244,239,230,0.32)',
                    transition: 'color 400ms',
                    textWrap: 'balance',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {TITLES[i]}
                  </div>

                  <div style={{ flex: 1 }} />

                  <div style={{
                    marginTop: 8,
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'var(--mono)', fontSize: 9,
                    letterSpacing: '0.16em',
                    color: ready ? 'var(--washi)' : 'rgba(244,239,230,0.45)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {ready ? (
                      <>
                        <PlayIcon />
                        <span>{j.duration}</span>
                      </>
                    ) : (
                      <span>{stage} · {j.duration}</span>
                    )}
                  </div>

                  <div style={{
                    marginTop: 6, height: 2,
                    background: 'rgba(244,239,230,0.06)',
                    borderRadius: 1, overflow: 'hidden', position: 'relative',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${p * 100}%`,
                      background: ready
                        ? 'var(--persimmon)'
                        : 'linear-gradient(90deg, rgba(200,76,43,0.5), var(--persimmon))',
                      transition: 'width 320ms var(--ease)',
                    }} />
                    {!ready && (
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${(t * 30) % 130 - 30}%`,
                        width: '30%',
                        background: 'linear-gradient(90deg, transparent, rgba(244,239,230,0.4), transparent)',
                        pointerEvents: 'none',
                      }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {readyCount > 0 && readyCount < JOBS.length && (
            <div style={{
              marginTop: 10, textAlign: 'center',
              fontFamily: 'var(--mono)', fontSize: 9,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              color: 'rgba(244,239,230,0.32)',
            }}>
              tap a ready one to begin · or wait for them all
            </div>
          )}
        </div>

        {/* divider */}
        <div style={{
          margin: '22px 24px 14px',
          display: 'flex', alignItems: 'center', gap: 14,
          fontFamily: 'var(--mono)', fontSize: 9,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(244,239,230,0.3)',
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(244,239,230,0.08)' }} />
          what you've carried
          <div style={{ flex: 1, height: 1, background: 'rgba(244,239,230,0.08)' }} />
        </div>

        {/* PAST */}
        <div style={{ padding: '0 24px' }}>
          {PAST.map((it, i) => (
            <div
              key={i}
              onClick={() => goto('player')}
              style={{
                padding: '13px 0',
                cursor: 'pointer',
                borderTop: i === 0 ? '1px solid rgba(244,239,230,0.06)' : 'none',
                borderBottom: '1px solid rgba(244,239,230,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{
                fontFamily: 'var(--jp)', fontSize: 26,
                color: 'var(--persimmon)', opacity: 0.7,
                width: 28, textAlign: 'center',
              }}>
                {it.kanji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 9,
                  letterSpacing: '0.22em', textTransform: 'uppercase',
                  color: 'var(--stone)',
                  display: 'flex', gap: 10,
                }}>
                  <span>{it.day}</span>
                  <span>·</span>
                  <span>{it.skin}</span>
                  <span>·</span>
                  <span>{it.mins}m</span>
                </div>
                <div style={{
                  marginTop: 3,
                  fontFamily: 'var(--serif)', fontStyle: 'italic',
                  fontSize: 15, lineHeight: 1.3,
                  color: 'rgba(244,239,230,0.88)',
                }}>
                  {it.name}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--serif)', fontStyle: 'italic',
                fontSize: 12, color: 'var(--persimmon)', opacity: 0.85,
                flexShrink: 0,
              }}>
                "{it.word}"
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
