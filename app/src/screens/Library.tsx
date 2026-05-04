import { useEffect } from 'react';
import type { Route } from '../lib/router';
import { Glow, TopBar, Eyebrow, Display } from '../components/atoms';
import { haptic } from '../lib/telegram';
import { isLibraryAvailable } from '../lib/library';
import { useLibrary } from '../state/library';
import { generatedMeditationApi } from '../state/generatedMeditation';
import type { LibraryItem, Vibe } from '../lib/types-meditation';

const KANJI: Record<Vibe, string> = {
  raw: '!?',
  cosmic: '✦',
  iron: '力',
  zen: '無',
  sleep: '夢',
};

const fmtMin = (s: number) => {
  const safe = Math.max(0, Math.floor(s));
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const fmtDate = (iso: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export function Library({ goto }: { goto: (r: Route) => void }) {
  const { items, loading, loaded, error, refresh, remove } = useLibrary();

  useEffect(() => {
    if (isLibraryAvailable()) refresh();
  }, [refresh]);

  const open = (item: LibraryItem) => {
    haptic.light();
    generatedMeditationApi.set({
      meditationId: item.meditationId,
      audioUrl: item.audioUrl,
      durationSec: item.durationSec,
      style: '',
      lyrics: '',
      vibe: item.vibe,
      templateId: '',
      generatedAt: item.generatedAt,
      providerMeta: {
        llm: { provider: '', model: '', latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
        audio: { provider: '', jobId: '', latencyMs: 0, candidates: 0, chosenCandidate: 0 },
        persistence: { provider: '', latencyMs: 0 },
        totalLatencyMs: 0,
      },
    });
    goto('player');
  };

  const onRemove = async (item: LibraryItem) => {
    haptic.medium();
    try {
      await remove(item.meditationId);
    } catch {
      /* error message surfaces via store */
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)' }}>
      <Glow intensity={0.10} />
      <TopBar onBack={() => goto('welcome')} center="library" />

      <div style={{
        position: 'absolute', top: 110, bottom: 24, left: 0, right: 0,
        padding: '0 24px', overflowY: 'auto',
      }}>
        <Eyebrow>— saved meditations —</Eyebrow>
        <div style={{ height: 12 }} />
        <Display size={26}>What you've kept.</Display>

        {!isLibraryAvailable() && (
          <div style={{
            marginTop: 30,
            fontFamily: 'var(--serif)', fontStyle: 'italic',
            fontSize: 16, color: 'var(--stone)', lineHeight: 1.5,
          }}>
            Library is bound to your Telegram account. Open this app inside Telegram to save meditations.
          </div>
        )}

        {isLibraryAvailable() && loading && !loaded && (
          <div style={{
            marginTop: 30,
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--stone)',
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            loading…
          </div>
        )}

        {isLibraryAvailable() && error && (
          <div style={{
            marginTop: 16,
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--persimmon)',
          }}>
            {error}
          </div>
        )}

        {isLibraryAvailable() && loaded && items.length === 0 && !error && (
          <div style={{
            marginTop: 30,
            fontFamily: 'var(--serif)', fontStyle: 'italic',
            fontSize: 16, color: 'var(--stone)', lineHeight: 1.5,
          }}>
            Nothing saved yet. After a session, tap "Save to library" on the player.
          </div>
        )}

        {items.length > 0 && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item) => (
              <div
                key={item.meditationId}
                style={{
                  padding: '14px 16px', borderRadius: 14,
                  background: 'rgba(244,239,230,0.04)',
                  border: '1px solid rgba(244,239,230,0.08)',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}
              >
                <div style={{
                  fontFamily: 'var(--jp)', fontSize: 28, lineHeight: 1,
                  color: 'var(--persimmon)', flexShrink: 0, paddingTop: 4,
                }}>
                  {KANJI[item.vibe]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button
                    onClick={() => open(item)}
                    style={{
                      textAlign: 'left', appearance: 'none', background: 'transparent',
                      color: 'var(--washi)', padding: 0,
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 9.5,
                      letterSpacing: '0.22em', textTransform: 'uppercase',
                      color: 'var(--persimmon)', marginBottom: 4,
                    }}>
                      {item.vibe}
                    </div>
                    <div style={{
                      fontFamily: 'var(--serif)', fontStyle: 'italic',
                      fontSize: 17, lineHeight: 1.3,
                      color: 'var(--washi)', marginBottom: 4,
                    }}>
                      {item.capturePreview || `meditation for ${item.callMe}`}
                    </div>
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 10,
                      color: 'var(--stone)',
                    }}>
                      {fmtMin(item.durationSec)} · {fmtDate(item.generatedAt)}
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => onRemove(item)}
                  style={{
                    color: 'var(--stone)',
                    fontFamily: 'var(--mono)', fontSize: 9.5,
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                    padding: 6,
                    flexShrink: 0,
                  }}
                  aria-label="Remove from library"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
