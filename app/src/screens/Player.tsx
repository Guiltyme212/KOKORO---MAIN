import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnimationTime } from '../lib/hooks';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import { Glow, TopBar, Display } from '../components/atoms';
import type { ContentType } from '../types';
import { useGeneratedMeditation } from '../state/generatedMeditation';
import { useLibrary } from '../state/library';
import { isLibraryAvailable } from '../lib/library';

const META: Record<ContentType, { tag: string; name: string; kanji: string }> = {
  unwind: { tag: 'heart · Unwind', name: 'Vent. Then breathe.', kanji: '心' },
  attract: { tag: 'future · Attract', name: 'A scene you can enter.', kanji: '未' },
  lockin: { tag: 'will · Lock In', name: 'One rep of being him.', kanji: '志' },
};

const fmt = (s: number) => {
  const safe = Math.max(0, Math.floor(s));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

export function Player({ goto }: { goto: (r: Route) => void }) {
  const { answers } = useAnswers();
  const { generated } = useGeneratedMeditation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ct: ContentType = answers.contentType || 'unwind';
  const becoming = answers.becoming || 'calm';
  const isCinematic = ct === 'attract';

  const meta = META[ct];
  const total = Math.max(1, Math.round(generated?.durationSec ?? 1));

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const t = useAnimationTime();

  useEffect(() => {
    if (!generated) return;
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setElapsed(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    audio.play().catch(() => setPlaying(false));

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [generated]);

  const progress = Math.min(1, elapsed / total);

  const bars = useMemo(() => {
    const values: number[] = [];
    let seed = 11;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 80; i++) {
      const env = Math.sin((i / 80) * Math.PI) * 0.6 + 0.4;
      values.push(env * (0.3 + rnd() * 0.7));
    }
    return values;
  }, []);

  const seek = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(total, audio.currentTime + delta));
    setElapsed(audio.currentTime);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    haptic.medium();
    if (audio.paused) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  };

  if (!generated) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)' }}>
        <Glow intensity={0.10} />
        <TopBar onBack={() => goto('contentType')} center="player" />
        <div style={{
          position: 'absolute', inset: '0 28px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', gap: 24,
        }}>
          <div style={{ fontFamily: 'var(--jp)', fontSize: 150, color: 'var(--persimmon)', opacity: 0.22 }}>
            心
          </div>
          <Display size={26}>No meditation yet.</Display>
          <button
            onClick={() => goto('composing')}
            style={{
              padding: '14px 24px', borderRadius: 100,
              background: 'var(--persimmon)', color: 'var(--washi)',
              fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18,
            }}
          >
            Compose one
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)', overflow: 'hidden' }}>
      <audio ref={audioRef} src={generated.audioUrl} preload="auto" />

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
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          alignItems: 'center', gap: 28,
        }}>
          <div style={{
            fontFamily: 'var(--jp)', fontSize: 190, lineHeight: 1, color: 'var(--persimmon)',
            opacity: 0.18 + 0.06 * Math.sin(t * 0.8),
            filter: 'drop-shadow(0 0 30px rgba(200,76,43,0.4))',
            transform: `scale(${1 + 0.02 * Math.sin(t * 0.6)})`,
            userSelect: 'none',
          }}>
            {meta.kanji}
          </div>
          <div style={{ textAlign: 'center' }}>
            <Display size={25}>{meta.name}</Display>
            <div style={{
              marginTop: 10,
              fontFamily: 'var(--mono)', fontSize: 10.5,
              letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--stone)',
            }}>
              toward {becoming}
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 28px 36px' }}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 2, marginBottom: 12 }}>
          {bars.map((value, i) => {
            const barP = i / bars.length;
            const played = barP <= progress;
            const isHead = Math.abs(barP - progress) < 1.5 / bars.length;
            const mod = playing && played ? 1 + 0.12 * Math.sin(t * 3 + i * 0.5) : 1;
            const h = Math.max(2, value * 40 * mod);
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
          <span>-{fmt(total - elapsed)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
          <button
            style={{
              color: 'var(--stone)',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1,
              padding: 8,
            }}
            onClick={() => { haptic.light(); seek(-15); }}
          >
            -15s
          </button>
          <button
            onClick={toggle}
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
            onClick={() => { haptic.light(); seek(15); }}
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
            End
          </button>
          <SaveButton />
        </div>
      </div>
    </div>
  );
}

function SaveButton() {
  const { generated } = useGeneratedMeditation();
  const { items, save, remove, error } = useLibrary();
  const [pending, setPending] = useState(false);

  if (!generated) return null;
  if (!isLibraryAvailable()) {
    return (
      <span style={{
        color: 'var(--stone)', fontFamily: 'var(--mono)', fontSize: 10,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        padding: 8,
      }}>
        open in telegram to save
      </span>
    );
  }

  const saved = items.some((item) => item.meditationId === generated.meditationId);
  const label = pending
    ? (saved ? 'Removing…' : 'Saving…')
    : (saved ? 'Saved · tap to remove' : 'Save to library');

  const onClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      haptic.light();
      if (saved) {
        await remove(generated.meditationId);
      } else {
        await save(generated.meditationId);
        haptic.success();
      }
    } catch {
      // error surfaces via store; local fallback message handled below
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <button
        onClick={onClick}
        disabled={pending}
        style={{
          color: saved ? 'var(--washi)' : 'var(--persimmon)',
          fontFamily: 'var(--sans)', fontSize: 12,
          padding: 8,
          opacity: pending ? 0.5 : 1,
        }}
      >
        {label}
      </button>
      {error && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--stone)',
          padding: '0 8px',
        }}>
          {error}
        </span>
      )}
    </div>
  );
}
