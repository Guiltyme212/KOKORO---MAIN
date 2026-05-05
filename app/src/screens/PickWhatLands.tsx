import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '../lib/router';
import { TopBar } from '../components/atoms';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import type { Vibe } from '../types';
import {
  kickoffAllMeditations,
  kickoffMeditationFor,
  useMeditationProgress,
  type PipelinePhase,
} from '../state/meditationProgress';
import {
  generatedMeditationApi,
  useGeneratedMeditationsByVibe,
} from '../state/generatedMeditation';

type Job = {
  id: string;
  vibe: Vibe;
  voice: string;
  desc: string;
  title: string;
  duration: string;
  kanji: string;
  color: string;
};

const JOBS: Job[] = [
  { id: 'j1', vibe: 'raw',    voice: 'Gen Z',     desc: 'raw · unfiltered',  title: 'no notes. just real shit.',         duration: '7:12', kanji: '感', color: '#c84c2b' },
  { id: 'j2', vibe: 'cosmic', voice: 'Spiritual', desc: 'cosmic · mystic',   title: 'Align with your higher frequency.', duration: '6:48', kanji: '静', color: '#d4a36a' },
  { id: 'j3', vibe: 'sleep',  voice: 'Drift',     desc: 'bedtime · slow',    title: 'Eyes heavy. Let it all go.',        duration: '8:04', kanji: '空', color: '#7a8e6a' },
  { id: 'j4', vibe: 'iron',   voice: 'Drive',     desc: 'iron · relentless', title: 'No excuses. Only reps.',            duration: '5:50', kanji: '力', color: '#e6b85c' },
  { id: 'j5', vibe: 'zen',    voice: 'Zen',       desc: 'silent · still',    title: 'Sit. Breathe. Watch it pass.',      duration: '6:30', kanji: '無', color: '#6b7fa8' },
];

const PAST = [
  { day: 'Yesterday', kanji: '未', skin: 'future',    name: 'A Tuesday in Amsterdam.',                  word: 'real',   mins: 7 },
  { day: 'Yesterday', kanji: '志', skin: 'lockin',    name: 'Stop negotiating with the smaller you.',   word: 'sharp',  mins: 4 },
  { day: 'Sun',       kanji: '感', skin: 'aftercare', name: 'Nobody saw the effort. I did.',            word: 'seen',   mins: 6 },
  { day: 'Sat',       kanji: '夜', skin: 'aftercare', name: "Tonight's reset.",                         word: 'soft',   mins: 8 },
  { day: 'Fri',       kanji: '志', skin: 'lockin',    name: 'One rep of being him.',                    word: 'ready',  mins: 5 },
];

// Maps pipeline phase to a 0–1 progress value. Pre-script drift fakes
// activity so the bar isn't frozen while the LLM thinks; phase events then
// snap to milestones.
function phaseProgress(phase: PipelinePhase, secondsSinceStart: number): number {
  switch (phase) {
    case 'idle':
      return 0;
    case 'starting': {
      const raw = Math.min(1, secondsSinceStart / 30);
      return 0.25 * (1 - Math.pow(1 - raw, 1.6));
    }
    case 'script':
      return 0.33;
    case 'streaming':
      return 0.72;
    case 'ready':
      return 1;
    case 'error':
      return 0;
  }
}

// Stage label tracks the real backend pipeline phases:
// writing (LLM) → voicing (Suno gen) → mastering (Suno finalize) → ready.
function stageLabel(p: number): string {
  if (p >= 1)    return 'ready';
  if (p >= 0.65) return 'mastering';
  if (p >= 0.30) return 'voicing';
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
  const { answers } = useAnswers();
  const progressMap = useMeditationProgress();
  const byVibe = useGeneratedMeditationsByVibe();
  const [t, setT] = useState(0);
  const [preparingHintFor, setPreparingHintFor] = useState<string | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);
  const firstReadyHapticFired = useRef(false);

  // Picked card mirrors the user's vibe choice from screen 04. The matching
  // card moves to the top row, full width; the other 4 sit in the 2x2 grid.
  const pickedVibe: Vibe = answers.vibe || 'zen';
  const orderedJobs = useMemo(() => {
    const picked = JOBS.find((j) => j.vibe === pickedVibe);
    if (!picked) return JOBS;
    return [picked, ...JOBS.filter((j) => j.vibe !== pickedVibe)];
  }, [pickedVibe]);

  // Animation tick for shimmer + pulse + per-card pre-script drift.
  // `t` resets to 0 on mount and the screen mounts right after kickoff
  // fires from Mirror, so `t` doubles as seconds-since-start for the
  // picked vibe. The other 4 vibes start ~1s later; the drift formula is
  // forgiving so we accept a small offset there rather than threading a
  // wall-clock anchor through render.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (ts: number) => {
      setT((ts - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Safety fallback: if the user lands here with all slots idle (e.g. direct
  // hash navigation), kick off all 5 vibes. Normal flow fires the kickoff
  // from Mirror's Create button.
  useEffect(() => {
    const allIdle = JOBS.every((j) => progressMap[j.vibe].phase === 'idle');
    if (allIdle) {
      kickoffAllMeditations(answers, pickedVibe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Light haptic the first time any card becomes ready.
  useEffect(() => {
    if (firstReadyHapticFired.current) return;
    const anyReady = JOBS.some((j) => {
      const p = progressMap[j.vibe].phase;
      return p === 'streaming' || p === 'ready';
    });
    if (anyReady) {
      firstReadyHapticFired.current = true;
      haptic.success();
    }
  }, [progressMap]);

  const readyCount = JOBS.filter((j) => {
    const p = progressMap[j.vibe].phase;
    return p === 'streaming' || p === 'ready';
  }).length;

  const errorCount = JOBS.filter((j) => progressMap[j.vibe].phase === 'error').length;

  const onCardClick = (job: Job) => {
    const cardPhase = progressMap[job.vibe].phase;

    if (cardPhase === 'streaming' || cardPhase === 'ready') {
      // Promote this vibe's record into the "currently playing" slot, then
      // navigate. Player reads the promoted record on first render.
      if (byVibe[job.vibe]) {
        generatedMeditationApi.selectVibeAsCurrent(job.vibe);
        goto('player');
      }
      return;
    }

    if (cardPhase === 'error') {
      kickoffMeditationFor(job.vibe, answers);
      haptic.medium();
      return;
    }

    // Mid-flight (starting/script): show the "still preparing" hint.
    setPreparingHintFor(job.id);
    if (hintTimeoutRef.current) window.clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = window.setTimeout(() => setPreparingHintFor(null), 1500);
  };

  const headerCopy = (() => {
    if (errorCount === JOBS.length) return '— something broke · tap any to retry —';
    if (readyCount === JOBS.length) return '— all ready · pick what lands —';
    if (readyCount > 0) return `— ${readyCount} of ${JOBS.length} ready · pick or wait —`;
    return `— composing · ${readyCount} of ${JOBS.length} ready —`;
  })();

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
            color: readyCount === JOBS.length ? 'var(--persimmon)' : 'var(--stone)',
            transition: 'color 320ms var(--ease)',
          }}>
            {headerCopy}
          </div>

          <div style={{ height: 12 }} />

          <h1 style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
            fontSize: 28, lineHeight: 1.05, letterSpacing: -0.7,
            margin: 0, color: 'var(--washi)',
            textWrap: 'balance',
          }}>
            {readyCount === JOBS.length
              ? <>Five ways in.<br />Pick what lands.</>
              : <>Kokoro is making<br />five for you.</>}
          </h1>

          <div style={{
            marginTop: 10,
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
            fontSize: 14, lineHeight: 1.45,
            color: 'rgba(244,239,230,0.55)',
            maxWidth: 320, textWrap: 'balance',
          }}>
            Different styles, different rhythms. The one that lands is yours.
          </div>
        </div>

        {/* CARDS */}
        <div style={{ marginTop: 18, padding: '0 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {orderedJobs.map((j, i) => {
              const isPicked = j.vibe === pickedVibe;
              const slot = progressMap[j.vibe];
              const startedAt = slot.startedAt;
              // Drift-only proxy: `t` is rAF seconds since this screen
              // mounted. Picked vibe fires at mount-time so its t≈seconds
              // since kickoff. Other 4 fire ~1s later so their drift is
              // ~1s ahead of true; close enough for the soft-drift visual.
              const secondsSinceStart = startedAt !== null ? Math.max(0, t) : 0;
              const p = phaseProgress(slot.phase, secondsSinceStart);
              const ready = slot.phase === 'streaming' || slot.phase === 'ready';
              const errored = slot.phase === 'error';
              const pct = Math.round(p * 100);
              const pulse = ready ? 1 : Math.sin(t * 1.6 + i) * 0.15 + 0.85;
              const stage = errored ? 'try again' : stageLabel(p);
              const showHint = preparingHintFor === j.id;

              const borderColor = errored
                ? 'rgba(200,76,43,0.55)'
                : ready
                  ? 'rgba(200,76,43,0.4)'
                  : isPicked
                    ? 'rgba(200,76,43,0.32)'
                    : 'rgba(244,239,230,0.08)';

              return (
                <button
                  key={j.id}
                  onClick={() => onCardClick(j)}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    appearance: 'none',
                    gridColumn: isPicked ? '1 / -1' : 'auto',
                    background: ready
                      ? 'rgba(200,76,43,0.06)'
                      : errored
                        ? 'rgba(200,76,43,0.04)'
                        : isPicked
                          ? 'rgba(200,76,43,0.035)'
                          : 'rgba(244,239,230,0.025)',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 12,
                    padding: '14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'transform 240ms var(--ease), background 240ms var(--ease), border-color 240ms var(--ease)',
                    minHeight: 132,
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--washi)',
                    transform: showHint ? 'translateX(2px)' : 'translateX(0)',
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

                  {isPicked && !errored && (
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
                      background: ready
                        ? 'var(--persimmon)'
                        : errored
                          ? 'rgba(200,76,43,0.6)'
                          : 'rgba(244,239,230,0.4)',
                      opacity: ready ? 1 : pulse,
                      transition: 'opacity 240ms',
                    }} />
                    {ready ? 'ready' : errored ? 'failed' : `${pct}%`}
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
                    {j.title}
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
                        : errored
                          ? 'rgba(200,76,43,0.5)'
                          : 'linear-gradient(90deg, rgba(200,76,43,0.5), var(--persimmon))',
                      transition: 'width 320ms var(--ease)',
                    }} />
                    {!ready && !errored && (
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

          <div style={{
            marginTop: 10, textAlign: 'center', minHeight: 14,
            fontFamily: 'var(--mono)', fontSize: 9,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'rgba(244,239,230,0.32)',
            transition: 'opacity 240ms var(--ease)',
            opacity: preparingHintFor || errorCount > 0 ? 1 : 0,
          }}>
            {errorCount > 0
              ? 'tap a failed card to retry'
              : preparingHintFor
                ? 'still composing this one. it will land soon.'
                : ''}
          </div>
        </div>

        {/* divider */}
        <div style={{
          margin: '16px 24px 14px',
          display: 'flex', alignItems: 'center', gap: 14,
          fontFamily: 'var(--mono)', fontSize: 9,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(244,239,230,0.3)',
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(244,239,230,0.08)' }} />
          previous meditations
          <div style={{ flex: 1, height: 1, background: 'rgba(244,239,230,0.08)' }} />
        </div>

        {/* PAST */}
        <div style={{ padding: '0 24px' }}>
          {PAST.slice(0, 2).map((it, i, arr) => (
            <div
              key={i}
              onClick={() => goto('player')}
              style={{
                padding: '16px 0',
                cursor: 'pointer',
                borderBottom: i === arr.length - 1
                  ? 'none'
                  : '1px solid rgba(244,239,230,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {/* play button — solid persimmon disc, washi triangle */}
              <div style={{
                width: 32, height: 32, flexShrink: 0,
                borderRadius: '50%',
                background: 'var(--persimmon)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.22), ' +
                  'inset 0 -4px 10px rgba(0,0,0,0.18)',
              }}>
                <svg width="9" height="11" viewBox="0 0 9 11" aria-hidden style={{ marginLeft: 1 }}>
                  <path
                    d="M0.8 0.8 L0.8 10.2 L8 5.5 Z"
                    fill="var(--washi)"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--serif)', fontStyle: 'italic',
                  fontSize: 15, lineHeight: 1.3,
                  color: 'rgba(244,239,230,0.88)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {it.name}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'var(--stone)', flexShrink: 0,
              }}>
                {it.day} · {it.mins}m
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
