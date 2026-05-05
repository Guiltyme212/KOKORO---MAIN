import { useEffect, useRef, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnimationTime } from '../lib/hooks';
import { haptic } from '../lib/telegram';
import { Glow, TopBar } from '../components/atoms';
import { createStt } from '../lib/stt';
import { useGeneratedMeditation } from '../state/generatedMeditation';
import { useLibrary } from '../state/library';
import { isLibraryAvailable } from '../lib/library';
import { sendFeedback } from '../lib/feedback';

type Verdict = 'yes' | 'no' | null;
type Adjust = 'softer' | 'sharper' | 'shorter' | 'longer' | null;

const ADJUSTS: Exclude<Adjust, null>[] = ['softer', 'sharper', 'shorter', 'longer'];
const QUICK_FILLS = ['lighter', 'steady', 'tired', 'clear', 'softer', 'still'];

export function Reflect({ goto }: { goto: (r: Route) => void }) {
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [adjust, setAdjust] = useState<Adjust>(null);
  const [word, setWord] = useState('');
  const [recording, setRecording] = useState(false);
  const [feedbackSentFor, setFeedbackSentFor] = useState<Verdict>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useAnimationTime();

  const { generated } = useGeneratedMeditation();
  const { items, save, remove, error: libError } = useLibrary();
  const [savePending, setSavePending] = useState(false);
  const meditationId = generated?.meditationId;
  const saved = !!meditationId && items.some((item) => item.meditationId === meditationId);

  // STT — single-utterance mode for a short word/phrase. Final transcript
  // lands in the same `word` state the text input is bound to.
  const [stt] = useState(() => createStt({
    continuous: false,
    onFinal: (text) => {
      setWord(text.trim().slice(0, 28));
      setRecording(false);
    },
    onError: () => setRecording(false),
  }));

  useEffect(() => () => stt.stop(), [stt]);

  const close = () => {
    haptic.light();
    stt.stop();
    goto('welcome');
  };

  const onVerdict = (next: Exclude<Verdict, null>) => {
    haptic.selection();
    setVerdict(next);
    if (!meditationId || feedbackSentFor === next) return;
    setFeedbackSentFor(next);
    void sendFeedback(meditationId, next === 'yes').catch(() => {
      // Swallow — UX shouldn't break on feedback send. We can revisit if
      // we add explicit "feedback failed" surfaces later.
    });
  };

  const onSaveTap = async () => {
    if (!meditationId || savePending) return;
    if (!isLibraryAvailable()) return;
    haptic.medium();
    setSavePending(true);
    try {
      if (saved) {
        await remove(meditationId);
      } else {
        await save(meditationId);
        haptic.success();
      }
    } catch {
      // libError surfaces via store
    } finally {
      setSavePending(false);
    }
  };

  const onMicTap = () => {
    haptic.medium();
    inputRef.current?.blur();
    if (recording) {
      stt.stop();
      setRecording(false);
      return;
    }
    setRecording(true);
    stt.start();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)' }}>
      <Glow intensity={0.10} />
      <TopBar center="reflect" />

      <div style={{
        position: 'absolute', top: 110, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'var(--jp)', fontSize: 320, fontWeight: 300,
          color: 'rgba(200,76,43,0.045)',
          transform: `scale(${1 + Math.sin(t * 0.8) * 0.02})`,
          userSelect: 'none',
        }}>
          心
        </div>
      </div>

      <div style={{
        position: 'absolute', inset: 0,
        padding: '290px 32px 280px',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9.5,
            letterSpacing: '0.32em', textTransform: 'uppercase',
            color: 'var(--stone)', marginBottom: 18,
          }}>
            — stay a moment —
          </div>
          <div style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
            fontSize: 38, lineHeight: 1.1, letterSpacing: -0.6,
            color: 'var(--washi)',
          }}>
            How does it feel,<br />right now?
          </div>
        </div>

        <div style={{
          marginTop: 40, textAlign: 'center',
          display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9.5,
            letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--stone)',
          }}>
            did it land?
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 22 }}>
            {([
              { id: 'yes' as const, label: 'yes' },
              { id: 'no'  as const, label: 'not quite' },
            ]).map((v) => {
              const sel = verdict === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onVerdict(v.id)}
                  style={{
                    padding: '4px 2px',
                    fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
                    fontSize: 19, letterSpacing: -0.1,
                    color: sel ? 'var(--persimmon)' : 'rgba(244,239,230,0.55)',
                    borderBottom: sel ? '1px solid var(--persimmon)' : '1px solid transparent',
                    transition: 'all 240ms var(--ease)',
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          {meditationId && (
            <div style={{
              marginTop: 26,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <button
                onClick={onSaveTap}
                disabled={savePending || !isLibraryAvailable()}
                style={{
                  appearance: 'none',
                  padding: '14px 36px',
                  borderRadius: 100,
                  background: saved ? 'transparent' : 'var(--persimmon)',
                  border: saved
                    ? '1px solid rgba(244,239,230,0.4)'
                    : '1px solid var(--persimmon)',
                  color: saved ? 'var(--washi)' : 'var(--washi)',
                  fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 19,
                  letterSpacing: -0.1,
                  boxShadow: saved ? 'none' : '0 0 40px rgba(200,76,43,0.32)',
                  opacity: savePending || !isLibraryAvailable() ? 0.55 : 1,
                  transition: 'all 240ms var(--ease)',
                  cursor: isLibraryAvailable() ? 'pointer' : 'not-allowed',
                }}
              >
                {savePending
                  ? (saved ? 'Removing…' : 'Saving…')
                  : (saved ? 'Saved · tap to remove' : 'Save to library')}
              </button>
              {!isLibraryAvailable() && (
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--stone)',
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                }}>
                  open in telegram to save
                </span>
              )}
              {libError && isLibraryAvailable() && (
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--persimmon)',
                  textAlign: 'center', maxWidth: 240,
                }}>
                  {libError}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{
          marginTop: 28,
          opacity: verdict ? 1 : 0,
          transform: verdict ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 500ms var(--ease), transform 500ms var(--ease)',
          pointerEvents: verdict ? 'auto' : 'none',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 14,
          }}>
            next time, make it
          </div>
          <div style={{ display: 'inline-flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
            {ADJUSTS.map((a) => {
              const sel = adjust === a;
              return (
                <button
                  key={a}
                  onClick={() => { haptic.selection(); setAdjust(sel ? null : a); }}
                  style={{
                    padding: '2px 0',
                    fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
                    fontSize: 16,
                    color: sel ? 'var(--washi)' : 'rgba(244,239,230,0.4)',
                    borderBottom: sel ? '1px solid var(--washi)' : '1px solid transparent',
                    transition: 'all 240ms var(--ease)',
                  }}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 32, right: 32, bottom: 96 }}>
        <div style={{
          position: 'relative',
          background: 'rgba(244,239,230,0.04)',
          border: `1px solid ${word ? 'rgba(200,76,43,0.45)' : 'rgba(244,239,230,0.12)'}`,
          borderRadius: 18,
          padding: `16px ${stt.isSupported ? '52px' : '22px'} 16px 22px`,
          transition: 'all 320ms var(--ease)',
          boxShadow: word ? '0 0 28px rgba(200,76,43,0.10)' : 'none',
        }}>
          <input
            ref={inputRef}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            maxLength={28}
            placeholder="a word, a feeling…"
            style={{
              width: '100%',
              color: 'var(--washi)', fontFamily: 'var(--serif)', fontStyle: 'italic',
              fontWeight: 300, fontSize: 20, textAlign: 'center',
              caretColor: 'var(--persimmon)',
            }}
          />
          {stt.isSupported && (
            <button
              onClick={onMicTap}
              aria-label="speak instead"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, borderRadius: '50%',
                background: recording ? 'var(--persimmon)' : 'transparent',
                color: recording ? 'var(--washi)' : 'rgba(244,239,230,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: recording ? '0 0 30px rgba(200,76,43,0.5)' : 'none',
                transition: 'all 240ms var(--ease)',
              }}
            >
              <svg width="14" height="18" viewBox="0 0 22 28" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="6" y="2" width="10" height="16" rx="5" />
                <path d="M2 14a9 9 0 0 0 18 0" strokeLinecap="round" />
                <path d="M11 23v3" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div style={{
          marginTop: 12,
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 18px',
        }}>
          {QUICK_FILLS.map((s) => (
            <button
              key={s}
              onClick={() => { haptic.selection(); setWord(s); }}
              style={{
                padding: '4px 0',
                fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
                fontSize: 13,
                color: word === s ? 'var(--persimmon)' : 'rgba(244,239,230,0.4)',
                transition: 'color 200ms',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {recording && (
          <div style={{
            marginTop: 8, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.28em',
            textTransform: 'uppercase', color: 'var(--persimmon)',
          }}>
            listening…
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute', bottom: 28, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <button
          onClick={close}
          style={{
            color: 'rgba(244,239,230,0.7)',
            fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.32em',
            textTransform: 'uppercase', padding: '10px 28px',
          }}
        >
          close · 心
        </button>
      </div>
    </div>
  );
}
