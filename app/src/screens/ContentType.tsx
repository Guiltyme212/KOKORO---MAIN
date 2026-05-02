import { useState } from 'react';
import type { Route } from '../lib/router';
import { useAnswers } from '../state/answers';
import { haptic } from '../lib/telegram';
import { Glow, TopBar, Eyebrow, Display, Btn } from '../components/atoms';
import type { ContentType as CT, VoiceId } from '../types';

const TYPES: { id: CT; kanji: string; name: string; tagline: string; body: string; mins: number }[] = [
  {
    id: 'unwind', kanji: '心',
    name: 'Unwind',
    tagline: 'Soft. Like talking to someone who gets it.',
    body: 'Warm voice, slow pace, room to feel. ~6 min.',
    mins: 6,
  },
  {
    id: 'attract', kanji: '未',
    name: 'Attract',
    tagline: 'Cinematic. Rehearse the life you’re building.',
    body: 'Narrated scene from your near-future. Vivid, calm, identity-shaping. ~7 min.',
    mins: 7,
  },
  {
    id: 'lockin', kanji: '志',
    name: 'Lock In',
    tagline: 'Direct. Mental reps for discipline.',
    body: 'Sharp voice, intense pace, no negotiation with the weaker version of you. ~4 min.',
    mins: 4,
  },
];

const VOICES: { id: VoiceId; name: string; accent: string }[] = [
  { id: 'mira', name: 'Mira', accent: 'EN · soft' },
  { id: 'brad', name: 'Brad', accent: 'EN · grounded' },
  { id: 'aiko', name: 'Aiko', accent: 'EN/JP' },
  { id: 'sage', name: 'Sage', accent: 'EN · neutral' },
];

export function ContentType({ goto }: { goto: (r: Route) => void }) {
  const { answers, setAnswer } = useAnswers();
  const [pick, setPick] = useState<CT>(answers.contentType || 'unwind');
  const [voice, setVoice] = useState<VoiceId>(answers.voiceId || 'mira');
  const [previewing, setPreviewing] = useState<VoiceId | null>(null);

  const onContinue = () => {
    setAnswer('contentType', pick);
    setAnswer('voiceId', voice);
    setAnswer('voice', VOICES.find((v) => v.id === voice)?.name ?? '');
    haptic.light();
    goto('composing');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--sumi)', color: 'var(--washi)' }}>
      <Glow intensity={0.10} />
      <TopBar onBack={() => goto('mirror')} center="shape · voice" />

      <div style={{ padding: '14px 28px 0' }}>
        <Eyebrow>— the meditation —</Eyebrow>
        <div style={{ height: 8 }} />
        <Display size={24}>How should it feel?</Display>
      </div>

      <div style={{
        position: 'absolute', top: 168, bottom: 224, left: 0, right: 0,
        padding: '0 24px', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {TYPES.map((s) => {
          const sel = s.id === pick;
          return (
            <button
              key={s.id}
              onClick={() => { haptic.selection(); setPick(s.id); }}
              style={{
                appearance: 'none', textAlign: 'left',
                padding: '14px 16px',
                background: sel ? 'rgba(200,76,43,0.08)' : 'rgba(244,239,230,0.025)',
                border: sel ? '1px solid var(--persimmon)' : '1px solid rgba(244,239,230,0.08)',
                borderRadius: 14,
                color: 'var(--washi)',
                display: 'flex', gap: 16, alignItems: 'flex-start',
                transition: 'all 240ms var(--ease)',
              }}
            >
              <div style={{
                fontFamily: 'var(--jp)', fontSize: 30, lineHeight: 1,
                color: sel ? 'var(--persimmon)' : 'var(--stone)',
                flexShrink: 0, paddingTop: 2,
              }}>
                {s.kanji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 9.5,
                  letterSpacing: '0.22em', textTransform: 'uppercase',
                  color: sel ? 'var(--persimmon)' : 'var(--stone)',
                  marginBottom: 4,
                }}>
                  {s.name}
                </div>
                <div style={{
                  fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400,
                  fontSize: 17, lineHeight: 1.2, color: 'var(--washi)',
                  marginBottom: 5,
                }}>
                  {s.tagline}
                </div>
                <div style={{
                  fontFamily: 'var(--sans)', fontSize: 12, lineHeight: 1.45,
                  color: 'rgba(244,239,230,0.65)',
                }}>
                  {s.body}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ position: 'absolute', bottom: 96, left: 0, right: 0, padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 10, height: 1, background: 'rgba(244,239,230,0.2)' }} />
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--stone)',
          }}>voice</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(244,239,230,0.06)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {VOICES.map((v) => {
            const sel = voice === v.id;
            const playing = previewing === v.id;
            return (
              <div
                key={v.id}
                onClick={() => { haptic.selection(); setVoice(v.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 100,
                  background: sel ? 'rgba(200,76,43,0.10)' : 'rgba(244,239,230,0.03)',
                  border: sel ? '1px solid var(--persimmon)' : '1px solid rgba(244,239,230,0.1)',
                  transition: 'all 200ms var(--ease)',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewing(playing ? null : v.id);
                    if (!playing) window.setTimeout(() => setPreviewing(null), 1800);
                  }}
                  style={{
                    width: 22, height: 22, borderRadius: 11,
                    background: playing ? 'var(--persimmon)' : 'transparent',
                    border: `1px solid ${playing ? 'var(--persimmon)' : 'rgba(244,239,230,0.3)'}`,
                    color: playing ? 'var(--washi)' : 'var(--stone)',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {playing ? (
                    <svg width="7" height="8" viewBox="0 0 7 8" fill="currentColor">
                      <rect x="0" width="2" height="8" />
                      <rect x="5" width="2" height="8" />
                    </svg>
                  ) : (
                    <svg width="7" height="8" viewBox="0 0 7 8" fill="currentColor">
                      <path d="M0 0 L7 4 L0 8 Z" />
                    </svg>
                  )}
                </button>
                <div style={{ minWidth: 0, flex: 1, lineHeight: 1.1 }}>
                  <div style={{
                    fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500,
                    color: sel ? 'var(--washi)' : 'rgba(244,239,230,0.92)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {v.name}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 8.5, marginTop: 2, color: 'var(--stone)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {v.accent}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 22px' }}>
        <Btn full onClick={onContinue}>Compose my meditation</Btn>
      </div>
    </div>
  );
}
