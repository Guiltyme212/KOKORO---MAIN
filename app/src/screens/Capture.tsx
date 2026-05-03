import { useEffect, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnimationTime } from '../lib/hooks';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import { Glow, TopBar, Eyebrow, Display, Btn } from '../components/atoms';
import { createStt } from '../lib/stt';

type Mode = 'voice' | 'type' | 'chips';

const STATES = [
  'anxious', 'angry', 'ashamed', 'overthinking', 'tired', 'unfocused',
  'stuck', 'rejected', 'excited', 'numb', 'hungry', 'disciplined',
];

// Fallback for when STT is unavailable or the user taps Continue without speaking.
const VOICE_SAMPLE = "I had a long day. I'm holding pressure I can't put down, and the feeling that no one really saw how much effort I put in.";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const errorHint = (err: string) => {
  if (err === 'not-allowed' || err === 'service-not-allowed') return 'mic permission denied';
  if (err === 'no-speech') return "didn't catch that — try again";
  if (err === 'audio-capture') return 'no microphone found';
  return 'transcription unavailable';
};

export function Capture({ goto }: { goto: (r: Route) => void }) {
  const { answers, setAnswer } = useAnswers();
  const [mode, setMode] = useState<Mode>('voice');
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [typed, setTyped] = useState(answers.carry || '');
  const [chips, setChips] = useState<string[]>(
    answers.chips.length ? answers.chips : ['anxious', 'overthinking'],
  );
  const [transcript, setTranscript] = useState('');
  const [partial, setPartial] = useState('');
  const [sttError, setSttError] = useState<string | null>(null);

  const t = useAnimationTime();

  // STT handle — created once. setState identities are stable so the closures
  // captured here always read the latest React state via setState's updater form.
  const [stt] = useState(() => createStt({
    continuous: true,
    onPartial: (text) => setPartial(text),
    onFinal: (text) => { setTranscript(text); setPartial(''); },
    onError: (err) => { setSttError(err); setRecording(false); },
  }));

  useEffect(() => () => stt.stop(), [stt]);

  // tick the recording timer while voice mode is recording
  useEffect(() => {
    if (!recording || mode !== 'voice') return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording, mode]);

  const toggleChip = (c: string) => {
    haptic.selection();
    setChips((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const onMicTap = () => {
    haptic.medium();
    if (recording) {
      stt.stop();
      setRecording(false);
      return;
    }
    setTranscript('');
    setPartial('');
    setSttError(null);
    setSecs(0);
    setRecording(true);
    stt.start();
  };

  const onContinue = () => {
    if (mode === 'voice') {
      const real = (transcript + (partial ? ` ${partial}` : '')).trim();
      setAnswer('carry', real || VOICE_SAMPLE);
    }
    if (mode === 'type') setAnswer('carry', typed || 'Still wired from today.');
    if (mode === 'chips') setAnswer('carry', `Carrying ${chips.join(', ')}.`);
    setAnswer('chips', chips);
    haptic.light();
    stt.stop();
    goto('contentType');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)' }}>
      <Glow intensity={mode === 'voice' ? 0.22 : 0.1} />
      <TopBar onBack={() => goto('welcome')} center="01 · what you're carrying" />

      <div style={{
        position: 'absolute', top: 110, bottom: 170, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 28px',
      }}>
        {mode === 'voice' && (
          <>
            <Eyebrow color="var(--stone)">
              {recording ? '— listening —' : '— ready when you are —'}
            </Eyebrow>
            <div style={{ height: 16 }} />
            <Display size={32}>
              {recording ? (
                <>Tell me what today<br />actually was.</>
              ) : (
                <>Tap to begin<br />when you’re ready.</>
              )}
            </Display>

            <div style={{
              marginTop: 36, height: 140,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {[0, 1, 2, 3].map((r) => {
                const phase = (t * 0.5 + r * 0.25) % 1;
                const scale = 0.6 + phase * 1.4;
                const alpha = (1 - phase) * 0.25;
                return (
                  <div
                    key={r}
                    style={{
                      position: 'absolute',
                      width: 140, height: 140, borderRadius: '50%',
                      border: `1px solid rgba(200,76,43,${alpha})`,
                      transform: `scale(${scale})`,
                      pointerEvents: 'none',
                    }}
                  />
                );
              })}
              <button
                onClick={onMicTap}
                style={{
                  width: 92, height: 92, borderRadius: '50%',
                  background: recording ? 'var(--persimmon)' : 'transparent',
                  border: recording ? 'none' : '1px solid rgba(244,239,230,0.4)',
                  color: 'var(--washi)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: recording ? '0 0 60px rgba(200,76,43,0.5)' : 'none',
                  transition: 'all 240ms var(--ease)',
                  position: 'relative', zIndex: 2,
                }}
              >
                <svg width="22" height="32" viewBox="0 0 22 32" fill="currentColor">
                  <rect x="6" y="2" width="10" height="18" rx="5" />
                  <path d="M2 14 v2 a9 9 0 0 0 18 0 v-2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  <line x1="11" y1="24" x2="11" y2="30" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>

            <div style={{
              marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 3, height: 44,
            }}>
              {Array.from({ length: 28 }).map((_, i) => {
                const v = recording
                  ? 0.25 + 0.75 * Math.abs(Math.sin(t * 4 + i * 0.6) * Math.cos(t * 1.2 + i * 0.2))
                  : 0.1;
                return (
                  <div
                    key={i}
                    style={{
                      width: 3, height: `${v * 40}px`,
                      background: 'var(--persimmon)', opacity: 0.7,
                      borderRadius: 1.5,
                      transition: 'height 80ms linear',
                    }}
                  />
                );
              })}
            </div>

            <div style={{
              marginTop: 18, textAlign: 'center',
              fontFamily: 'var(--mono)', fontSize: 11,
              letterSpacing: '0.22em', color: 'var(--stone)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(secs)} · {recording ? 'recording' : 'paused'}
            </div>

            {/* live transcript card */}
            {(transcript || partial) && (
              <div style={{
                marginTop: 14, padding: '0 4px',
                fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
                fontSize: 18, lineHeight: 1.4, letterSpacing: -0.1,
                textAlign: 'center', textWrap: 'pretty',
              }}>
                <span style={{ color: 'var(--washi)' }}>{transcript}</span>
                {partial && (
                  <span style={{ color: 'var(--persimmon)', opacity: 0.78 }}>
                    {transcript ? ' ' : ''}{partial}
                  </span>
                )}
              </div>
            )}

            {sttError && !transcript && !partial && (
              <div style={{
                marginTop: 14, textAlign: 'center',
                fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.22em',
                textTransform: 'uppercase', color: 'var(--stone)',
              }}>
                {errorHint(sttError)}
              </div>
            )}

            {!stt.isSupported && (
              <div style={{
                marginTop: 14, textAlign: 'center',
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
                textTransform: 'uppercase', color: 'var(--stone)',
              }}>
                transcription unavailable — try Type
              </div>
            )}
          </>
        )}

        {mode === 'type' && (
          <>
            <Eyebrow color="var(--stone)">— write —</Eyebrow>
            <div style={{ height: 16 }} />
            <Display size={30}>What's going on?</Display>
            <textarea
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Long day. Pitch tomorrow. Can't quiet down."
              style={{
                marginTop: 28, width: '100%', minHeight: 180,
                color: 'var(--washi)',
                borderTop: '1px solid rgba(244,239,230,0.18)',
                resize: 'none',
                fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
                fontSize: 22, lineHeight: 1.45, letterSpacing: -0.2,
                padding: '20px 0', caretColor: 'var(--persimmon)',
              }}
            />
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em',
              color: 'var(--stone)', textAlign: 'right',
            }}>
              {typed.length} char
            </div>
          </>
        )}

        {mode === 'chips' && (
          <>
            <Eyebrow color="var(--stone)">— tap what fits —</Eyebrow>
            <div style={{ height: 16 }} />
            <Display size={30}>Name what's there.</Display>
            <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {STATES.map((c) => {
                const sel = chips.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleChip(c)}
                    style={{
                      appearance: 'none',
                      padding: '10px 16px', borderRadius: 100,
                      background: sel ? 'var(--persimmon)' : 'transparent',
                      border: sel ? '1px solid var(--persimmon)' : '1px solid rgba(244,239,230,0.22)',
                      color: sel ? 'var(--washi)' : 'rgba(244,239,230,0.85)',
                      fontFamily: 'var(--sans)', fontSize: 13.5,
                      letterSpacing: 0.1, transition: 'all 240ms var(--ease)',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 14 }}>
          {([
            { k: 'voice', label: 'Speak' },
            { k: 'type',  label: 'Type'  },
            { k: 'chips', label: 'Tap'   },
          ] as { k: Mode; label: string }[]).map((m) => (
            <button
              key={m.k}
              onClick={() => {
                if (m.k !== 'voice' && recording) { stt.stop(); setRecording(false); }
                setMode(m.k);
              }}
              style={{
                padding: '8px 18px',
                fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: mode === m.k ? 'var(--washi)' : 'var(--stone)',
                position: 'relative',
              }}
            >
              {m.label}
              {mode === m.k && (
                <div style={{
                  position: 'absolute', bottom: 2, left: '20%', right: '20%',
                  height: 1, background: 'var(--persimmon)',
                }} />
              )}
            </button>
          ))}
        </div>
        <Btn full onClick={onContinue}>Continue</Btn>
      </div>
    </div>
  );
}
