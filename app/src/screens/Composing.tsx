import { useEffect, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnswers } from '../state/answers';
import { haptic, isInTelegram, tgUser, tgInitData } from '../lib/telegram';
import { Glow, TopBar } from '../components/atoms';
import type { Vibe } from '../types';
import { generateMeditation } from '../lib/api';
import { uploadCapture } from '../lib/uploads';
import { captureAudioApi } from '../state/captureAudio';
import type {
  Capture,
  ClientInfo,
  GenerateMeditationInput,
  GenerateMeditationOutput,
  Locale,
} from '../lib/types-meditation';
import { generatedMeditationApi } from '../state/generatedMeditation';

const ESTIMATED_DURATION_MS = 90000;
let inFlight:
  | { key: string; promise: Promise<GenerateMeditationOutput> }
  | null = null;

const VIBE_NAME: Record<Vibe, string> = {
  raw: 'Raw',
  cosmic: 'Cosmic',
  iron: 'Iron',
  zen: 'Zen',
  sleep: 'Sleep',
};

const makeRequestId = () => {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const resolveLocale = (): Locale => {
  const tgLang = tgUser()?.language_code?.toLowerCase();
  if (tgLang?.startsWith('ru')) return 'ru';
  if (tgLang?.startsWith('en')) return 'en';
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
};

const buildClientInfo = (): ClientInfo => {
  const user = tgUser();
  if (user) {
    return {
      source: 'telegram',
      tgUserId: user.id,
      tgUsername: user.username,
      tgFirstName: user.first_name,
      tgLanguageCode: user.language_code,
      tgIsPremium: user.is_premium,
      tgInitData: tgInitData() || undefined,
    };
  }
  return { source: isInTelegram() ? 'telegram' : 'web' };
};

export function Composing({ goto }: { goto: (r: Route) => void }) {
  const { answers } = useAnswers();
  const [t, setT] = useState(0);
  const [phase, setPhase] = useState<'working' | 'ready' | 'error'>('working');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (ts: number) => {
      const e = ts - start;
      setT(e / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const vibe: Vibe = answers.vibe || 'zen';
    const carry = answers.carry.trim();
    const recordedBlob = captureAudioApi.take();

    const fallbackCapture: Capture = carry
      ? { kind: 'text', text: carry }
      : { kind: 'theme', chips: answers.chips.length ? answers.chips : ['tired'] };

    let cancelled = false;

    const buildCaptureWithUpload = async (): Promise<Capture> => {
      if (!recordedBlob || !carry) return fallbackCapture;
      try {
        const upload = await uploadCapture(recordedBlob);
        if (cancelled) return fallbackCapture;
        return {
          kind: 'voice',
          audioUrl: upload.audioUrl,
          mimeType: upload.mimeType,
          transcribedText: carry,
        };
      } catch {
        // Upload failed — keep going with the transcript so the user still
        // gets their meditation. We just lose the audio recording for this run.
        return fallbackCapture;
      }
    };

    void (async () => {
      const capture = await buildCaptureWithUpload();
      if (cancelled) return;

      const input: GenerateMeditationInput = {
        callMe: answers.callMe.trim() || 'friend',
        realName: answers.realName?.trim() || undefined,
        capture,
        vibe,
        locale: resolveLocale(),
        requestId: makeRequestId(),
        client: buildClientInfo(),
      };
      const key = JSON.stringify({ ...input, requestId: undefined });

      const promise = inFlight?.key === key
        ? inFlight.promise
        : generateMeditation(input);
      inFlight = { key, promise };

      promise
        .then((out) => {
          if (cancelled) return;
          if (inFlight?.promise === promise) inFlight = null;
          generatedMeditationApi.set(out);
          setPhase('ready');
          haptic.success();
          window.setTimeout(() => goto('player'), 650);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (inFlight?.promise === promise) inFlight = null;
          setError(err instanceof Error ? err.message : 'generation failed');
          setPhase('error');
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [answers, goto]);

  const progress =
    phase === 'ready' ? 1 : Math.min(0.95, (t * 1000) / ESTIMATED_DURATION_MS);
  const vibeName = VIBE_NAME[answers.vibe || 'zen'];

  const lines = [
    'Holding what you told me.',
    'Choosing the shape underneath.',
    `Tuning to ${vibeName.toLowerCase()}.`,
    `Composing the ${vibeName.toLowerCase()} script.`,
    'Voicing it into music.',
    'Saving the audio.',
  ];

  const errorLines = [
    'Something broke upstream.',
    'Your words are still here.',
    'Try once more in a moment.',
  ];

  const activeLines = phase === 'error' ? errorLines : lines;
  const thresholds = phase === 'error'
    ? [0, 0.33, 0.66]
    : [0, 0.12, 0.28, 0.48, 0.68, 0.88];
  let activeIdx = 0;
  for (let k = 0; k < thresholds.length; k++) if (progress >= thresholds[k]) activeIdx = k;

  const retry = () => {
    haptic.medium();
    window.location.reload();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)', overflow: 'hidden' }}>
      <Glow intensity={0.18} />
      <TopBar center="composing" />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingBottom: 260,
        transition: 'opacity 600ms var(--ease), transform 800ms var(--ease)',
        opacity: phase === 'ready' ? 0.65 : 1,
        transform: phase === 'ready' ? 'scale(0.78) translateY(-8px)' : 'scale(1)',
      }}>
        <div style={{ position: 'relative', width: 280, height: 280 }}>
          {phase !== 'ready' && [0, 1, 2, 3].map((r) => {
            const phase01 = ((t * 0.45) + r * 0.25) % 1;
            const scale = 0.55 + phase01 * 1.05;
            const alpha = (1 - phase01) * (0.18 + 0.18 * progress);
            return (
              <div
                key={r}
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div style={{
                  width: 200, height: 200, borderRadius: '50%',
                  border: `1px solid rgba(200,76,43,${alpha})`,
                  transform: `scale(${scale})`,
                }} />
              </div>
            );
          })}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--jp)', fontSize: 220, fontWeight: 400,
            color: phase === 'error' ? 'var(--stone)' : 'var(--persimmon)',
            opacity: 0.32 + 0.55 * progress,
            transform: `scale(${1 + Math.sin(t * 1.1) * 0.04})`,
            filter: `drop-shadow(0 0 ${20 + 30 * progress}px rgba(200,76,43,${0.35 + 0.3 * progress}))`,
            userSelect: 'none',
            transition: 'opacity 400ms var(--ease), color 400ms var(--ease)',
          }}>
            心
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 28, right: 28, bottom: 168,
        textAlign: 'center', minHeight: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: phase === 'ready' ? 0 : 1,
        transition: 'opacity 600ms var(--ease)',
      }}>
        {activeLines.map((line, i) => {
          const active = i === activeIdx;
          return (
            <div
              key={line}
              style={{
                position: 'absolute', left: 0, right: 0,
                fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
                fontSize: 22, lineHeight: 1.35,
                color: 'var(--washi)',
                opacity: active ? 0.92 : 0,
                transform: active ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 900ms var(--ease), transform 900ms var(--ease)',
                padding: '0 16px',
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {phase === 'error' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 48,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          padding: '0 28px',
          animation: 'v2pop 700ms var(--ease) both',
        }}>
          <div style={{
            maxWidth: 330,
            fontFamily: 'var(--mono)', fontSize: 9.5,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--stone)', textAlign: 'center', lineHeight: 1.6,
            overflowWrap: 'anywhere',
          }}>
            {error}
          </div>
          <button
            onClick={retry}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              padding: '14px 24px', borderRadius: 100,
              background: 'var(--persimmon)', color: 'var(--washi)',
              boxShadow: '0 0 60px rgba(200,76,43,0.35)',
              fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18,
              whiteSpace: 'nowrap',
            }}
          >
            Try again
          </button>
          <style>{`@keyframes v2pop { from { opacity: 0; transform: translateY(12px); } }`}</style>
        </div>
      )}

      {phase === 'ready' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 56,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          animation: 'v2pop 700ms var(--ease) both',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9.5,
            letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'var(--persimmon)',
          }}>
            - ready -
          </div>
          <style>{`@keyframes v2pop { from { opacity: 0; transform: translateY(12px); } }`}</style>
        </div>
      )}
    </div>
  );
}
