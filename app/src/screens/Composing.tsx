import { useEffect, useState } from 'react';
import type { Route } from '../lib/router';
import { useAnswers } from '../state/answers';
import { haptic, isInTelegram, tgUser, tgInitData } from '../lib/telegram';
import { Glow, TopBar } from '../components/atoms';
import type { Vibe } from '../types';
import { generateMeditationStreaming } from '../lib/api';
import { uploadCapture } from '../lib/uploads';
import { captureAudioApi } from '../state/captureAudio';
import type {
  Capture,
  ClientInfo,
  GenerateMeditationInput,
  Locale,
} from '../lib/types-meditation';
import { generatedMeditationApi } from '../state/generatedMeditation';

// Player auto-advances on the 'streaming' event (~20-40s after submit).
// This estimate now drives only the visual progress carousel until phase
// flips to 'ready'.
const ESTIMATED_DURATION_MS = 40000;
let inFlight:
  | { key: string; promise: Promise<void> }
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

      // Drain the stream once per input. Cancellation only blocks setState
      // calls — the loop keeps running so the persisted audioUrl lands in
      // the store even if the user has already navigated to Player.
      const drain = inFlight?.key === key ? inFlight.promise : (async () => {
        let scriptVibe: Vibe = vibe;
        let templateId = '';
        let lyrics = '';
        let style = '';
        let generatedAt = '';
        let scriptMeditationId = '';

        for await (const ev of generateMeditationStreaming(input)) {
          if (ev.event === 'script') {
            scriptMeditationId = ev.meditationId;
            scriptVibe = ev.vibe;
            templateId = ev.templateId;
            lyrics = ev.lyrics;
            style = ev.style;
            generatedAt = ev.generatedAt;
          } else if (ev.event === 'streaming') {
            generatedMeditationApi.set({
              meditationId: ev.meditationId || scriptMeditationId,
              audioUrl: '',
              streamAudioUrl: ev.streamAudioUrl,
              durationSec: ev.durationSec,
              style,
              lyrics,
              vibe: scriptVibe,
              templateId,
              generatedAt,
              providerMeta: {
                llm: { provider: '', model: '', latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
                audio: { provider: '', jobId: '', latencyMs: 0, candidates: 0, chosenCandidate: 0 },
                persistence: { provider: '', latencyMs: 0 },
                totalLatencyMs: 0,
              },
            });
            if (!cancelled) {
              setPhase('ready');
              haptic.success();
              window.setTimeout(() => goto('player'), 650);
            }
          } else if (ev.event === 'ready') {
            generatedMeditationApi.update({
              audioUrl: ev.audioUrl,
              durationSec: ev.durationSec,
              providerMeta: ev.providerMeta,
            });
          }
        }
      })();

      inFlight = { key, promise: drain };

      try {
        await drain;
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'generation failed');
          setPhase('error');
        }
      } finally {
        if (inFlight?.promise === drain) inFlight = null;
      }
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
  // Error phase uses threshold-driven progression. Working phase advances
  // through the 6 lines at the start, then loops on the last 3 ("Composing
  // the script", "Voicing it into music", "Saving the audio") every 6s
  // until the streaming event fires — the previous behavior pinned at
  // "Saving the audio" forever, which felt broken when Suno was slow.
  let activeIdx = 0;
  if (phase === 'error') {
    const thresholds = [0, 0.33, 0.66];
    for (let k = 0; k < thresholds.length; k++) if (progress >= thresholds[k]) activeIdx = k;
  } else {
    const thresholds = [0, 0.12, 0.28, 0.48, 0.68, 0.88];
    for (let k = 0; k < thresholds.length; k++) if (progress >= thresholds[k]) activeIdx = k;
    // Once we've reached the last line and audio still isn't ready, keep
    // cycling through the last three every 6s so the screen feels alive.
    if (activeIdx === thresholds.length - 1) {
      const overflowMs = t * 1000 - ESTIMATED_DURATION_MS * thresholds[thresholds.length - 1];
      if (overflowMs > 6000) {
        const cycleStart = thresholds.length - 3;
        activeIdx = cycleStart + (Math.floor(overflowMs / 6000) % 3);
      }
    }
  }

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
