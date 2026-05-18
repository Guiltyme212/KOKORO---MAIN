import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  Clock3,
  Home,
  Library,
  Mic,
  MicOff,
  Moon,
  Pause,
  Play,
  Send,
  Sparkles,
  UserRound,
  Wind,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useConversation } from '@elevenlabs/react';
import type { Route } from '../lib/router';
import { getConversationSignedUrl } from '../lib/elevenlabs';
import { isLibraryAvailable } from '../lib/library';
import type { LibraryItem } from '../lib/types-meditation';
import { haptic } from '../lib/telegram';
import type { Answers, Vibe } from '../types';
import { useAnswers } from '../state/answers';
import { personaApi } from '../state/persona';
import {
  ALL_VIBES,
  kickoffAllMeditations,
  kickoffMeditationFor,
  meditationProgressApi,
  useMeditationProgress,
} from '../state/meditationProgress';
import {
  generatedMeditationApi,
  useGeneratedMeditation,
  useGeneratedMeditationsByVibe,
} from '../state/generatedMeditation';
import { useLibrary } from '../state/library';

const A = '/kokoro3/';

const SOFT_NAMES = ['Love', 'Babe', 'Honey', 'Baby', 'Sweetheart', 'Sunshine', 'Kitten'];
const MAIN_GOALS = [
  'Calm me down',
  'Help me sleep',
  'Give me confidence',
  'Let me talk it out',
  'Show me my future self',
  "I don't know",
];
const SOURCES = ['Work', 'Someone close', 'My head', 'My body', 'Money', 'The future', 'Family', 'No idea'];

const RECONNECT_FLAG = 'kokoro3_chat_seen_intro';
const RECONNECT_FIRST_MESSAGE = "Okay, I'm back. Pick it up wherever you want.";

const GOAL_CLAUSE: Record<string, string> = {
  'Calm me down': 'calm your stress',
  'Help me sleep': 'settle the restlessness',
  'Give me confidence': 'work on your self-doubt',
  'Let me talk it out': "talk through what's been heavy",
  'Show me my future self': "look at who you're becoming",
  "I don't know": "sit with whatever's weighing on you",
};

const SOURCE_TAIL: Record<string, string> = {
  'Work': ' around work',
  'Someone close': ' with someone close to you',
  'My head': ', up in your head',
  'My body': ', what your body is holding',
  'Money': ' around money',
  'The future': ' about the future',
  'Family': ' with family in the picture',
  'No idea': '',
};

function buildWeCanPhrase(mainGoal: string, source: string): string {
  const clause = GOAL_CLAUSE[mainGoal] || 'sit with whatever this is';
  const tail = SOURCE_TAIL[source] ?? '';
  return `${clause}${tail}`;
}

const VIBE_CARDS: Record<Vibe, {
  title: string;
  eyebrow: string;
  copy: string;
  accent: string;
  image: string;
}> = {
  raw: {
    title: 'Gen Z',
    eyebrow: 'raw - unfiltered',
    copy: 'No notes. Just real. Uses casual language and may swear.',
    accent: '#fc6708',
    image: 'kokoro-proud.mp4',
  },
  cosmic: {
    title: 'Spiritual',
    eyebrow: 'cosmic - mystic',
    copy: 'Soft, symbolic, a little lunar. Good for bigger feelings.',
    accent: '#8f8d3a',
    image: 'kokoro-float.mp4',
  },
  iron: {
    title: 'Drive',
    eyebrow: 'iron - direct',
    copy: 'Grounded pressure release. Less soft, more backbone.',
    accent: '#d56e25',
    image: 'kokoro-heart.mp4',
  },
  sleep: {
    title: 'Wind down',
    eyebrow: 'bedtime - slow',
    copy: 'Low and gentle for letting the day leave your body.',
    accent: '#71804b',
    image: 'kokoro-meditate.mp4',
  },
  zen: {
    title: 'Zen',
    eyebrow: 'still - clear',
    copy: 'Clean, quiet, breath-led. The safest default.',
    accent: '#64764e',
    image: 'kokoro-tea.mp4',
  },
};

type ScreenProps = { goto: (r: Route) => void };
type ChatMessage = { id: string; role: 'kokoro' | 'user' | 'system'; text: string };

function FadingBubble({ role, message }: { role: 'kokoro' | 'user'; message: ChatMessage | undefined }) {
  const [displayed, setDisplayed] = useState<{ id: string; text: string } | null>(
    message ? { id: message.id, text: message.text } : null,
  );
  const [leaving, setLeaving] = useState(false);
  const pendingRef = useRef<{ id: string; text: string } | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!message) return;
    if (displayed && displayed.id === message.id) {
      pendingRef.current = null;
      return;
    }

    if (!displayed) {
      setDisplayed({ id: message.id, text: message.text });
      return;
    }

    pendingRef.current = { id: message.id, text: message.text };

    if (timerRef.current !== null) return;

    setLeaving(true);
    timerRef.current = window.setTimeout(() => {
      const next = pendingRef.current;
      timerRef.current = null;
      pendingRef.current = null;
      if (next) setDisplayed(next);
      setLeaving(false);
    }, 240);
  }, [message?.id, message?.text, displayed]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  if (!displayed) return null;
  return (
    <div
      key={displayed.id}
      className={`k3-message k3-message-${role} ${leaving ? 'is-leaving' : 'is-entering'}`}
    >
      {displayed.text}
    </div>
  );
}

function Frame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <main className={`k3-frame ${className}`}>
      <img className="k3-sakura" src={`${A}sakura-branch.png`} alt="" draggable={false} />
      <span className="k3-petal k3-petal-a" />
      <span className="k3-petal k3-petal-b" />
      <span className="k3-petal k3-petal-c" />
      {children}
    </main>
  );
}

function ScenicFloor() {
  return (
    <>
      <img className="k3-ornament-bonsai" src={`${A}bonsai.png`} alt="" draggable={false} />
      <img className="k3-ornament-lantern" src={`${A}lantern.png`} alt="" draggable={false} />
      <div className="k3-cloud" aria-hidden="true">
        <svg viewBox="0 0 400 110" preserveAspectRatio="none">
          <path d="M0 60 Q 30 30, 80 40 Q 110 20, 160 30 Q 200 10, 250 28 Q 300 18, 340 36 Q 380 26, 400 50 L400 110 L0 110 Z" fill="#6B7A5A" />
          <path d="M0 75 Q 50 55, 100 65 Q 150 50, 210 65 Q 270 55, 330 70 Q 370 60, 400 78 L400 110 L0 110 Z" fill="#5C6B4D" />
        </svg>
      </div>
    </>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="k3-icon-button" onClick={onClick} aria-label="Back" title="Back">
      <ArrowLeft size={20} strokeWidth={2.4} />
    </button>
  );
}

function ProgressDots({ active, total = 5 }: { active: number; total?: number }) {
  return (
    <div className="k3-dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i === active ? 'is-active' : ''} />
      ))}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
  variant = 'mustard',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'mustard' | 'sunset';
}) {
  return (
    <button
      className={`k3-primary k3-primary-${variant}`}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic.light();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function MascotVideo({
  file,
  className = '',
  poster,
}: {
  file: string;
  className?: string;
  poster?: string;
}) {
  return (
    <video
      className={`k3-mascot ${className}`}
      autoPlay
      muted
      loop
      playsInline
      poster={poster ? `${A}${poster}` : undefined}
    >
      <source src={`${A}${file}`} type="video/mp4" />
    </video>
  );
}

function PeekVideo({
  file,
  loopFile,
  stillImage,
  active = true,
  variant = 'feather',
  className = '',
}: {
  file: string;
  loopFile?: string;
  stillImage?: string;
  active?: boolean;
  variant?: 'feather' | 'soft' | 'right';
  className?: string;
}) {
  const variantClass = variant === 'right'
    ? 'k3-peek-wrap--right'
    : variant === 'soft'
      ? 'k3-peek-wrap--soft'
      : 'k3-peek-wrap--feather';

  const [introDone, setIntroDone] = useState(false);
  const loopRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!introDone) return;
    const v = loopRef.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active, introDone]);

  if (!loopFile) {
    return (
      <div className={`k3-peek-wrap ${variantClass} ${className}`}>
        <video autoPlay loop muted playsInline>
          <source src={`${A}${file}`} type="video/mp4" />
        </video>
      </div>
    );
  }

  const layerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    mixBlendMode: 'multiply',
    display: 'block',
    transition: 'opacity 180ms ease',
  };

  const showLoop = introDone && active;
  const showStill = introDone && !active && !!stillImage;

  return (
    <div className={`k3-peek-wrap ${variantClass} ${className}`}>
      <video
        autoPlay
        muted
        playsInline
        onEnded={() => {
          setIntroDone(true);
          const v = loopRef.current;
          if (v && active) {
            v.currentTime = 0;
            void v.play().catch(() => {});
          }
        }}
        style={{ ...layerStyle, opacity: introDone ? 0 : 1 }}
      >
        <source src={`${A}${file}`} type="video/mp4" />
      </video>
      <video
        ref={loopRef}
        loop
        muted
        playsInline
        preload="auto"
        style={{ ...layerStyle, opacity: showLoop ? 1 : 0 }}
      >
        <source src={`${A}${loopFile}`} type="video/mp4" />
      </video>
      {stillImage && (
        <img
          src={`${A}${stillImage}`}
          alt=""
          draggable={false}
          style={{ ...layerStyle, opacity: showStill ? 1 : 0 }}
        />
      )}
    </div>
  );
}

function BlendedVideo({
  file,
  className = '',
  poster,
}: {
  file: string;
  className?: string;
  poster?: string;
}) {
  return (
    <div className={`k3-blended-video ${className}`}>
      <video
        autoPlay
        loop
        muted
        playsInline
        poster={poster ? `${A}${poster}` : undefined}
      >
        <source src={`${A}${file}`} type="video/mp4" />
      </video>
    </div>
  );
}

export function Welcome3({ goto }: ScreenProps) {
  const { reset } = useAnswers();

  return (
    <Frame className="k3-welcome">
      <section className="k3-welcome-title">
        <p>Welcome to</p>
        <h1>Kokoro</h1>
      </section>

      <div className="k3-sun" aria-hidden="true" />
      <img className="k3-bubble" src={`${A}bubble.png`} alt="Hi. I'm Kokoro. I'm here to listen." draggable={false} />
      <PeekVideo file="kokoro-peak.mp4" variant="right" className="k3-welcome-peek" />

      <ScenicFloor />
      <div className="k3-bottom-cta">
        <ProgressDots active={0} />
        <PrimaryButton
          onClick={() => {
            reset();
            generatedMeditationApi.resetAll();
            meditationProgressApi.reset();
            goto('name');
          }}
        >
          Nice to meet you.
        </PrimaryButton>
        <button className="k3-link" onClick={() => goto('home')}>I already have an account</button>
        <button
          className="k3-link"
          style={{ marginTop: 6, opacity: 0.45, fontSize: '0.78em' }}
          onClick={() => {
            reset();
            personaApi.reset();
            generatedMeditationApi.resetAll();
            meditationProgressApi.reset();
            try {
              sessionStorage.clear();
            } catch {
              /* storage unavailable */
            }
            window.location.hash = 'welcome';
            window.location.reload();
          }}
        >
          Hard reset (new user)
        </button>
      </div>
    </Frame>
  );
}

export function Name3({ goto }: ScreenProps) {
  const { answers, setAnswer } = useAnswers();
  const [name, setName] = useState(answers.realName || answers.callMe || '');
  const [softName, setSoftName] = useState(answers.callMe || '');

  const canContinue = name.trim().length > 0;

  return (
    <Frame className="k3-name">
      <BackButton onClick={() => goto('welcome')} />

      <div className="k3-name-mascot">
        <MascotVideo file="kokoro-proud.mp4" />
      </div>

      <section className="k3-center-copy k3-name-copy">
        <h2>Before we start -<br />what should I call you?</h2>
      </section>

      <input
        className="k3-name-input"
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        placeholder="Your name..."
        maxLength={60}
      />

      <section className="k3-chip-section">
        <div className="k3-divider-label"><span>What would your loved one call you?</span></div>
        <div className="k3-chip-grid">
          {SOFT_NAMES.map((label) => (
            <button
              key={label}
              className={`k3-chip ${softName === label ? 'is-selected' : ''}`}
              onClick={() => setSoftName(label)}
            >
              {label}
            </button>
          ))}
          <button className="k3-chip k3-chip-dashed" onClick={() => setSoftName(name.trim())}>
            + Your own...
          </button>
        </div>
      </section>

      <ScenicFloor />
      <div className="k3-bottom-cta">
        <ProgressDots active={1} />
        <PrimaryButton
          disabled={!canContinue}
          onClick={() => {
            const cleanName = name.trim();
            const callMe = (softName || cleanName).trim();
            setAnswer('realName', cleanName);
            setAnswer('callMe', callMe);
            personaApi.set({ callMe, realName: cleanName || undefined });
            goto('feeling');
          }}
        >
          Continue
        </PrimaryButton>
      </div>
    </Frame>
  );
}

export function Feeling3({ goto }: ScreenProps) {
  const { answers, setAnswer } = useAnswers();
  const [feeling, setFeeling] = useState(answers.feeling || '');

  return (
    <Frame className="k3-feeling">
      <BackButton onClick={() => goto('name')} />
      <div className="k3-speech-bubble">
        <strong>What do you need<br />from me today?</strong>
        <span>no wrong answer</span>
      </div>
      <div className="k3-tea-mascot">
        <MascotVideo file="kokoro-tea.mp4" poster="kokoro-meditate.png" />
      </div>

      <div className="k3-chip-grid k3-choice-cloud k3-feeling-cloud">
        {MAIN_GOALS.map((label) => (
          label === "I don't know" ? (
            <Fragment key={label}>
              <span className="k3-chip-break" />
              <button
                className={`k3-chip k3-chip-dashed ${feeling === label ? 'is-selected' : ''}`}
                onClick={() => setFeeling(label)}
              >
                {label}
              </button>
            </Fragment>
          ) : (
            <button
              key={label}
              className={`k3-chip ${feeling === label ? 'is-selected' : ''}`}
              onClick={() => setFeeling(label)}
            >
              {label}
            </button>
          )
        ))}
      </div>

      <ScenicFloor />
      <div className="k3-bottom-cta">
        <ProgressDots active={2} />
        <PrimaryButton
          disabled={!feeling}
          onClick={() => {
            setAnswer('feeling', feeling);
            setAnswer('chips', feeling ? [feeling] : []);
            if (feeling) personaApi.addTheme(feeling);
            goto('source');
          }}
        >
          Continue
        </PrimaryButton>
      </div>
    </Frame>
  );
}

export function Source3({ goto }: ScreenProps) {
  const { answers, setAnswer } = useAnswers();
  const [source, setSource] = useState(answers.source || '');

  return (
    <Frame className="k3-source">
      <BackButton onClick={() => goto('feeling')} />
      <div className="k3-speech-bubble k3-source-bubble">
        <strong>What is this<br />mostly about?</strong>
        <span>no wrong answer</span>
      </div>
      <div className="k3-heart-mascot">
        <MascotVideo file="kokoro-heart.mp4" />
      </div>

      <div className="k3-chip-grid k3-choice-cloud k3-source-cloud">
        {SOURCES.map((label) => (
          <button
            key={label}
            className={`k3-chip ${source === label ? 'is-selected' : ''}`}
            onClick={() => setSource(label)}
          >
            {label}
          </button>
        ))}
      </div>

      <ScenicFloor />
      <div className="k3-bottom-cta">
        <ProgressDots active={3} />
        <PrimaryButton
          disabled={!source}
          onClick={() => {
            setAnswer('source', source);
            setAnswer('chips', [answers.feeling, source].filter(Boolean) as string[]);
            if (source) personaApi.addTheme(source);
            goto('promise');
          }}
        >
          Tell Kokoro
        </PrimaryButton>
      </div>
    </Frame>
  );
}

export function Promise3({ goto }: ScreenProps) {
  return (
    <Frame className="k3-promise">
      <BackButton onClick={() => goto('source')} />
      <PeekVideo file="kokoro-peak.mp4" variant="right" className="k3-promise-peek" />

      <section className="k3-promise-copy">
        <h2>Whatever you tell me stays here.<br />I won't try to fix you.<br />I'll just listen - and make you something.</h2>
      </section>

      <div className="k3-reminder">
        <div className="k3-reminder-icon"><Clock3 size={19} /></div>
        <div>
          <strong>Gentle daily reminder</strong>
          <span>Skippable - set it later.</span>
        </div>
        <time>08:00 PM</time>
      </div>

      <ScenicFloor />
      <div className="k3-bottom-cta">
        <ProgressDots active={4} />
        <PrimaryButton onClick={() => goto('chat')}>Let's start.</PrimaryButton>
      </div>
    </Frame>
  );
}

function buildCaptureText(answers: Answers, messages: ChatMessage[]): string {
  const userLines = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.text)
    .join(' ')
    .trim();

  const parts = [
    answers.realName ? `User name: ${answers.realName}.` : '',
    answers.callMe ? `Call them: ${answers.callMe}.` : '',
    answers.feeling ? `How they are carrying today: ${answers.feeling}.` : '',
    answers.source ? `Where it seems to be coming from: ${answers.source}.` : '',
    userLines ? `What they told Kokoro: ${userLines}` : '',
  ].filter(Boolean);

  return parts.join('\n').slice(0, 1900);
}

function phaseLabel(phase: string | undefined): string {
  if (phase === 'starting') return 'connecting the thread';
  if (phase === 'script') return 'writing your meditation';
  if (phase === 'streaming') return 'ready to listen';
  if (phase === 'ready') return 'saved-quality audio ready';
  if (phase === 'error') return 'something failed';
  return 'waiting';
}

export function Chat3({ goto }: ScreenProps) {
  const { answers, setAnswer } = useAnswers();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'opening-1',
      role: 'kokoro',
      text: `Hey${answers.callMe ? ` ${answers.callMe}` : ''}. I can help you with whatever you're going through.`,
    },
    {
      id: 'opening-2',
      role: 'kokoro',
      text: 'Tell me one true thing. When I have enough, I will make a meditation from it.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [showStyles, setShowStyles] = useState(false);
  const [suggestedVibe, setSuggestedVibe] = useState<Vibe | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<Vibe | ''>(answers.vibe || '');
  const [agentError, setAgentError] = useState<string | null>(null);
  const [, setStartingVoice] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [mascotEmotion, setMascotEmotion] = useState<'warm' | 'surprised'>('warm');
  const messagesRef = useRef(messages);
  const seenEventsRef = useRef(new Set<string>());
  const announcedResultRef = useRef(false);
  const stylePanelRef = useRef<HTMLDivElement | null>(null);
  const [dismissedErrorVibes, setDismissedErrorVibes] = useState<Set<Vibe>>(() => new Set());

  useEffect(() => {
    if (showStyles && stylePanelRef.current) {
      stylePanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showStyles]);

  const progress = useMeditationProgress();
  const byVibe = useGeneratedMeditationsByVibe();
  const library = useLibrary();
  const phase = selectedVibe ? progress[selectedVibe]?.phase : 'idle';
  const result = selectedVibe ? byVibe[selectedVibe] : undefined;

  const autoSavedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isLibraryAvailable()) return;
    for (const vibe of ALL_VIBES) {
      const rec = byVibe[vibe];
      if (!rec || !rec.audioUrl || !rec.meditationId) continue;
      if (autoSavedRef.current.has(rec.meditationId)) continue;
      if (library.items.some((it) => it.meditationId === rec.meditationId)) {
        autoSavedRef.current.add(rec.meditationId);
        continue;
      }
      autoSavedRef.current.add(rec.meditationId);
      library.save(rec.meditationId).catch(() => {
        autoSavedRef.current.delete(rec.meditationId);
      });
    }
  }, [byVibe, library]);

  const latestKokoro = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'kokoro'),
    [messages],
  );
  const latestUser = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'user'),
    [messages],
  );

  const appendMessage = useCallback((role: ChatMessage['role'], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMessages((current) => {
      const next = [...current, { id: `${Date.now()}-${Math.random()}`, role, text: clean }];
      messagesRef.current = next;
      return next;
    });
  }, []);

  const conversation = useConversation({
    clientTools: {
      show_meditation_styles: (params: Record<string, unknown>) => {
        const suggested = typeof params.suggested === 'string' ? params.suggested : null;
        console.log('[11labs] tool show_meditation_styles', { suggested });
        setShowStyles(true);
        if (suggested && (ALL_VIBES as readonly string[]).includes(suggested)) {
          setSuggestedVibe(suggested as Vibe);
        } else {
          setSuggestedVibe(null);
        }
        return 'shown';
      },
      set_mascot_emotion: (params: Record<string, unknown>) => {
        const emotion = typeof params.emotion === 'string' ? params.emotion : 'warm';
        console.log('[11labs] tool set_mascot_emotion', { emotion });
        if (emotion === 'surprised' || emotion === 'warm') {
          setMascotEmotion(emotion);
        }
        return 'ok';
      },
    },
    onMessage: (event) => {
      const payload = event as {
        event_id?: string | number;
        source?: string;
        role?: string;
        message?: unknown;
      };
      const isUser = payload.role === 'user' || payload.source === 'user';
      const dedupeKey =
        payload.event_id === undefined
          ? ''
          : `${isUser ? 'user' : 'agent'}:${String(payload.event_id)}`;
      if (dedupeKey && seenEventsRef.current.has(dedupeKey)) return;
      if (dedupeKey) seenEventsRef.current.add(dedupeKey);

      const text = typeof payload.message === 'string' ? payload.message : '';
      if (!text.trim()) return;

      appendMessage(isUser ? 'user' : 'kokoro', text);
    },
    onError: (message, context) => {
      const text =
        typeof message === 'string'
          ? message
          : message && typeof message === 'object' && 'message' in message
            ? String((message as { message: unknown }).message)
            : JSON.stringify(message);
      console.error('[11labs] onError', { message, context, text });
      setAgentError(text || 'unknown agent error');
    },
    onConnect: (info) => {
      console.log('[11labs] onConnect', info);
    },
    onDisconnect: (details) => {
      console.log('[11labs] onDisconnect', details);
      setStartingVoice(false);
    },
    onStatusChange: (info) => {
      console.log('[11labs] onStatusChange', info);
    },
    onModeChange: (info) => {
      console.log('[11labs] onModeChange', info);
    },
    onDebug: (info) => {
      console.log('[11labs] onDebug', info);
    },
  });

  const {
    status,
    isSpeaking,
    isMuted,
    setMuted,
    startSession,
    endSession,
    sendUserMessage,
    sendContextualUpdate,
  } = conversation;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!selectedVibe || !result || announcedResultRef.current) return;
    if (phase !== 'streaming' && phase !== 'ready') return;
    announcedResultRef.current = true;
    appendMessage('kokoro', 'I made this for you. You can listen now.');
  }, [appendMessage, phase, result, selectedVibe]);

  const startVoice = async () => {
    if (status === 'connected') {
      setMuted(!isMuted);
      return;
    }

    setAgentError(null);
    setStartingVoice(true);
    try {
      console.log('[11labs] requesting conversation signed URL');
      const signedUrl = await getConversationSignedUrl();
      console.log('[11labs] got signedUrl, length=', signedUrl.length);
      const persona = personaApi.getSnapshot();
      const dynamicVariables = {
        call_me: answers.callMe || persona.callMe || 'friend',
        main_goal: answers.feeling || '',
        source: answers.source || '',
        we_can_phrase: buildWeCanPhrase(answers.feeling || '', answers.source || ''),
        is_returning_user: persona.callMe ? 'true' : 'false',
        recurring_themes: persona.themes,
        recent_meditations: persona.meditations,
      };
      let isReconnect = false;
      try {
        isReconnect = sessionStorage.getItem(RECONNECT_FLAG) === '1';
        sessionStorage.setItem(RECONNECT_FLAG, '1');
      } catch {
        /* storage unavailable */
      }
      console.log('[11labs] dynamicVariables', dynamicVariables, 'reconnect:', isReconnect);
      const result = startSession({
        signedUrl,
        connectionType: 'websocket',
        userId: answers.realName || answers.callMe || undefined,
        dynamicVariables,
        ...(isReconnect
          ? { overrides: { agent: { firstMessage: RECONNECT_FIRST_MESSAGE } } }
          : {}),
      });
      console.log('[11labs] startSession invoked', result);
    } catch (error) {
      console.error('[11labs] startVoice threw', error);
      setStartingVoice(false);
      setAgentError(error instanceof Error ? error.message : 'Could not start Kokoro voice');
    }
  };

  const submitTyped = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    appendMessage('user', text);
    if (status === 'connected') {
      sendUserMessage(text);
    } else {
      setShowStyles(true);
      appendMessage('kokoro', 'I hear you. Pick the style that should hold this, and I will start making it.');
    }
  };

  const startMeditation = (vibe: Vibe) => {
    const carry = buildCaptureText(answers, messagesRef.current);
    const nextAnswers: Answers = {
      ...answers,
      vibe,
      carry,
      chips: [answers.feeling, answers.source].filter(Boolean) as string[],
    };

    haptic.medium();
    announcedResultRef.current = false;
    setShowStyles(false);
    setSelectedVibe(vibe);
    setAnswer('vibe', vibe);
    setAnswer('carry', carry);
    meditationProgressApi.reset();
    generatedMeditationApi.resetAll();
    appendMessage('kokoro', `Okay. I am making this in ${VIBE_CARDS[vibe].title} style now. Stay with me here.`);
    if (status === 'connected') {
      sendContextualUpdate(
        `The user chose ${VIBE_CARDS[vibe].title} style. The app has started generating a personalized meditation in the background.`,
      );
    }
    kickoffAllMeditations(nextAnswers, vibe);
    personaApi.recordMeditation({ vibe, feeling: answers.feeling });
  };

  const openResult = () => {
    if (!selectedVibe) return;
    generatedMeditationApi.selectVibeAsCurrent(selectedVibe);
    goto('player');
  };

  return (
    <Frame className="k3-chat-frame">
      <header className="k3-chat-top">
        <BackButton onClick={() => goto('promise')} />
        <button
          className="k3-wrap-button"
          type="button"
          onClick={() => {
            if (status === 'connected') endSession();
            if (result) {
              openResult();
            } else {
              goto('home');
            }
          }}
        >
          Wrap up
          <Send size={15} />
        </button>
      </header>

      <PeekVideo
        file="kokoro-peek-talk.mp4"
        loopFile={mascotEmotion === 'surprised' ? 'kokoro-chat-surprised.mp4' : 'kokoro-chat-speaking.mp4'}
        stillImage={mascotEmotion === 'surprised' ? 'kokoro-still-surprised.png' : 'last-shot-of-kokoro-speaking-after-peaking.png'}
        active={isSpeaking}
        variant="right"
        className={`k3-chat-peek ${isSpeaking ? 'is-speaking' : ''} ${showStyles || typeOpen ? 'is-compact' : ''}`}
      />

      <div className="k3-bubble-slot k3-bubble-slot-kokoro">
        {showStyles ? (
          <div className="k3-message k3-message-kokoro k3-message-picker">
            <div className="k3-style-heading">
              <Sparkles size={17} />
              <span>Choose how it should land</span>
            </div>
            <div className="k3-style-grid">
              {ALL_VIBES.map((vibe) => (
                <button
                  key={vibe}
                  className={`k3-style-card ${suggestedVibe === vibe ? 'is-suggested' : ''}`}
                  style={{ '--accent': VIBE_CARDS[vibe].accent } as CSSProperties}
                  onClick={() => startMeditation(vibe)}
                >
                  <span>{VIBE_CARDS[vibe].eyebrow}</span>
                  <strong>{VIBE_CARDS[vibe].title}</strong>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <FadingBubble role="kokoro" message={latestKokoro} />
        )}
      </div>
      <div className="k3-bubble-slot k3-bubble-slot-user">
        <FadingBubble role="user" message={latestUser} />
      </div>

      <section className={`k3-chat-log ${showStyles ? 'has-panel' : ''} ${typeOpen ? 'is-typing-mode' : ''}`} aria-live="polite">

        {selectedVibe && phase !== 'idle' && phase !== 'error' && !result && (
          <div className="k3-making-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <span>{phaseLabel(phase)}</span>
              <strong>{VIBE_CARDS[selectedVibe].title}</strong>
            </div>
            {phase === 'ready' ? <Check size={18} /> : <Wind size={18} />}
          </div>
        )}

        {result && (phase === 'streaming' || phase === 'ready') && (
          <button className="k3-result-card" onClick={openResult}>
            <div>
              <span>Your meditation</span>
              <strong>{VIBE_CARDS[result.vibe].title} - {formatDuration(result.durationSec)}</strong>
            </div>
            <Play size={22} fill="currentColor" />
          </button>
        )}
      </section>

      {selectedVibe && phase === 'error' && !dismissedErrorVibes.has(selectedVibe) && (
        <div className="k3-error-toast" role="alert">
          <div className="k3-error-toast-text">
            <strong>Couldn't make {VIBE_CARDS[selectedVibe].title}</strong>
            <button
              type="button"
              className="k3-error-toast-retry"
              onClick={() => {
                meditationProgressApi.reset();
                const carry = buildCaptureText(answers, messagesRef.current);
                kickoffMeditationFor(selectedVibe, { ...answers, vibe: selectedVibe, carry }, null);
                setDismissedErrorVibes((prev) => {
                  const next = new Set(prev);
                  next.delete(selectedVibe);
                  return next;
                });
              }}
            >
              Try again
            </button>
          </div>
          <button
            type="button"
            className="k3-error-toast-close"
            aria-label="Dismiss error"
            onClick={() =>
              setDismissedErrorVibes((prev) => {
                const next = new Set(prev);
                next.add(selectedVibe);
                return next;
              })
            }
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
      )}

      {agentError && (
        <div className="k3-agent-error">
          Voice agent is unavailable right now. Typed chat still works.
        </div>
      )}

      <form className={`k3-chat-compose ${typeOpen ? 'is-open' : ''}`} onSubmit={submitTyped}>
        {!typeOpen && (
          <>
            <div className="k3-voice-controls">
              {status === 'connected' && (
                <button
                  type="button"
                  className="k3-end-btn"
                  onClick={() => endSession()}
                  title="Stop Kokoro and end the call"
                  aria-label="End call"
                >
                  <X size={20} strokeWidth={2.6} />
                </button>
              )}
              <button
                type="button"
                className={`k3-mic ${status === 'connected' && isMuted ? 'is-muted' : ''}`}
                onClick={startVoice}
                title={status === 'connected' ? (isMuted ? 'Unmute mic' : 'Mute mic') : 'Talk to Kokoro'}
                aria-label={status === 'connected' ? (isMuted ? 'Unmute mic' : 'Mute mic') : 'Talk to Kokoro'}
              >
                {status === 'connected' && isMuted ? <MicOff size={30} /> : <Mic size={32} />}
              </button>
              {status === 'connected' && <span className="k3-end-btn k3-end-btn--ghost" aria-hidden="true" />}
            </div>
            <div className="k3-voice-status">
              {status === 'connected'
                ? (isMuted ? 'mic muted - tap mic to unmute' : 'Kokoro is listening - tap mic to mute')
                : 'tap to speak'}
            </div>
            <button type="button" className="k3-type-toggle" onClick={() => setTypeOpen(true)}>
              Or type instead
            </button>
          </>
        )}
        {typeOpen && (
          <div className="k3-text-sheet">
            <button
              type="button"
              className="k3-text-close"
              onClick={() => setTypeOpen(false)}
              aria-label="Close text input"
              title="Back to voice"
            >
              <X size={18} strokeWidth={2.6} />
            </button>
            <input
              value={draft}
              onChange={(event) => {
                setDraft(event.currentTarget.value);
                if (status === 'connected') conversation.sendUserActivity();
              }}
              placeholder={status === 'connected' ? 'type instead...' : 'tell Kokoro...'}
              autoFocus
            />
            <button type="submit" className="k3-send" title="Send" aria-label="Send">
              <Send size={19} />
            </button>
          </div>
        )}
      </form>
    </Frame>
  );
}

function formatDuration(seconds: number | undefined): string {
  const safe = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function Player3({ goto }: ScreenProps) {
  const { generated } = useGeneratedMeditation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [actualDuration, setActualDuration] = useState(0);
  const src = generated?.streamAudioUrl || generated?.audioUrl || '';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setElapsed(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setActualDuration(audio.duration);
      }
    };
    const onDurationChange = onMeta;
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onDurationChange);
    void audio.play().catch(() => {});
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onDurationChange);
    };
  }, [src]);

  if (!generated || !src) {
    return (
      <Frame className="k3-player-empty">
        <BackButton onClick={() => goto('chat')} />
        <BlendedVideo file="kokoro-meditate.mp4" poster="kokoro-meditate.png" className="k3-empty-mascot" />
        <h2>No meditation yet.</h2>
        <PrimaryButton variant="sunset" onClick={() => goto('chat')}>Talk to Kokoro</PrimaryButton>
      </Frame>
    );
  }

  const total = Math.max(1, Math.round(actualDuration || generated.durationSec || 1));
  const progress = Math.min(1, elapsed / total);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    haptic.light();
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const seekFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const next = ratio * audio.duration;
    audio.currentTime = next;
    setElapsed(next);
    haptic.light();
  };

  return (
    <Frame className="k3-player">
      <audio ref={audioRef} src={src} preload="auto" />
      <header className="k3-player-top">
        <BackButton onClick={() => goto('chat')} />
        <span>{VIBE_CARDS[generated.vibe].eyebrow}</span>
        <button className="k3-icon-button" onClick={() => goto('home')} aria-label="Home" title="Home">
          <Home size={19} />
        </button>
      </header>

      <section className="k3-player-art">
        <BlendedVideo file="kokoro-meditate.mp4" poster="kokoro-meditate.png" className="k3-player-mascot" />
      </section>

      <section className="k3-player-copy">
        <span>Your meditation</span>
        <h1>{VIBE_CARDS[generated.vibe].title}</h1>
      </section>

      <div
        className="k3-progress-line"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.round(elapsed)}
        tabIndex={0}
        onPointerDown={seekFromPointer}
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="k3-time-row">
        <span>{formatDuration(elapsed)}</span>
        <span>{formatDuration(total)}</span>
      </div>

      <button className="k3-play-button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={32} fill="currentColor" /> : <Play size={34} fill="currentColor" />}
      </button>

      <SaveMeditationButton meditationId={generated.meditationId} persisted={!!generated.audioUrl} />
    </Frame>
  );
}

function SaveMeditationButton({ meditationId, persisted }: { meditationId: string; persisted: boolean }) {
  const { items, save, remove, error } = useLibrary();
  const [pending, setPending] = useState(false);

  if (!isLibraryAvailable()) {
    return <div className="k3-save-note">Open in Telegram to save to library.</div>;
  }

  const saved = items.some((item) => item.meditationId === meditationId);
  const disabled = pending || !persisted;

  const label = !persisted
    ? 'Preparing final audio...'
    : pending
      ? 'Working...'
      : saved
        ? 'Saved - tap to remove'
        : 'Save to library';

  const onClick = async () => {
    if (disabled) return;
    setPending(true);
    try {
      if (saved) await remove(meditationId);
      else await save(meditationId);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="k3-save-wrap">
      <button className="k3-save-button" disabled={disabled} onClick={onClick}>{label}</button>
      {error && <span>{error}</span>}
    </div>
  );
}

export function Home3({ goto }: ScreenProps) {
  const { answers } = useAnswers();
  const { generated } = useGeneratedMeditation();
  const byVibe = useGeneratedMeditationsByVibe();
  const greeting = answers.callMe || answers.realName || 'friend';
  const timeLabel = useMemo(
    () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    [],
  );

  const recentVibes = useMemo(() => {
    const generatedList = ALL_VIBES.filter((v) => byVibe[v]);
    if (generatedList.length > 0) return generatedList;
    return ['raw', 'zen', 'sleep'] as Vibe[];
  }, [byVibe]);

  const playVibe = (vibe: Vibe) => {
    if (byVibe[vibe]) {
      generatedMeditationApi.selectVibeAsCurrent(vibe);
      goto('player');
    } else {
      goto('chat');
    }
  };

  return (
    <Frame className="k3-home-frame">
      <section className="k3-home-head">
        <div className="k3-home-meta">
          <span className="k3-home-meta-kanji" lang="ja">朝</span>
          <span className="k3-home-meta-label">Morning</span>
          <span className="k3-home-meta-clock"><Clock3 size={11} />{timeLabel}</span>
        </div>
        <h1>Hey <strong>{greeting}</strong>.</h1>
        <p>How's your heart today?</p>
      </section>

      <button className="k3-home-hero" onClick={() => goto('chat')}>
        <div className="k3-home-hero-text">
          <span>Voice ritual</span>
          <strong>Talk to Kokoro</strong>
          <p>Tell me one true thing and I'll make you something.</p>
        </div>
        <div className="k3-home-hero-art">
          <video autoPlay muted loop playsInline poster={`${A}kokoro-meditate.png`}>
            <source src={`${A}kokoro-tea.mp4`} type="video/mp4" />
          </video>
        </div>
      </button>

      {generated && (
        <button className="k3-continue-card" onClick={() => goto('player')}>
          <span>Continue</span>
          <strong>{VIBE_CARDS[generated.vibe].title} meditation is ready</strong>
          <Send size={16} />
        </button>
      )}

      <div className="k3-home-tiles">
        <button onClick={() => goto('chat')}>
          <Wind size={18} />
          <strong>60-second reset</strong>
          <span>no story, just breath</span>
        </button>
        <button onClick={() => goto('chat')}>
          <Moon size={18} />
          <strong>Wind down</strong>
          <span>tonight's sleep ritual</span>
        </button>
      </div>

      <section className="k3-recent-section">
        <div>
          <span>From this week</span>
          <button onClick={() => goto('library')}>See library</button>
        </div>
        <div className="k3-recent-row">
          {recentVibes.map((vibe) => (
            <button
              key={vibe}
              className="k3-recent-card"
              style={{ '--pill': VIBE_CARDS[vibe].accent } as CSSProperties}
              onClick={() => playVibe(vibe)}
            >
              <div className="k3-recent-thumb">
                <video autoPlay muted loop playsInline>
                  <source src={`${A}${VIBE_CARDS[vibe].image}`} type="video/mp4" />
                </video>
              </div>
              <span>{VIBE_CARDS[vibe].title}</span>
              <strong>{VIBE_CARDS[vibe].copy}</strong>
            </button>
          ))}
        </div>
      </section>

      <TabBar active="home" goto={goto} />
    </Frame>
  );
}

export function Library3({ goto }: ScreenProps) {
  const { items, loading, loaded, error, refresh } = useLibrary();

  useEffect(() => {
    if (isLibraryAvailable()) void refresh();
  }, [refresh]);

  const open = (item: LibraryItem) => {
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

  return (
    <Frame className="k3-library-frame">
      <header className="k3-library-head">
        <BackButton onClick={() => goto('home')} />
        <h1>Library</h1>
      </header>

      {!isLibraryAvailable() && (
        <div className="k3-library-empty">
          <BookOpen size={30} />
          <h2>Your saved meditations live in Telegram.</h2>
          <p>Open Kokoro inside Telegram to save and replay them later.</p>
        </div>
      )}

      {isLibraryAvailable() && loading && !loaded && <div className="k3-library-empty">Loading...</div>}
      {isLibraryAvailable() && error && <div className="k3-library-empty">{error}</div>}
      {isLibraryAvailable() && loaded && items.length === 0 && !error && (
        <div className="k3-library-empty">
          <BookOpen size={30} />
          <h2>Nothing saved yet.</h2>
          <p>After a session, save from the player.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="k3-library-list">
          {items.map((item) => (
            <button key={item.meditationId} onClick={() => open(item)}>
              <span>{VIBE_CARDS[item.vibe].title}</span>
              <strong>{item.capturePreview || `Meditation for ${item.callMe}`}</strong>
              <small>{formatDuration(item.durationSec)}</small>
            </button>
          ))}
        </div>
      )}

      <TabBar active="library" goto={goto} />
    </Frame>
  );
}

function TabBar({ active, goto }: { active: 'home' | 'library' | 'talk' | 'progress' | 'you'; goto: (r: Route) => void }) {
  const tabs = useMemo(
    () => [
      { id: 'home', label: 'Home', icon: Home, route: 'home' as Route },
      { id: 'library', label: 'Library', icon: Library, route: 'library' as Route },
      { id: 'talk', label: 'Talk', icon: Mic, route: 'chat' as Route },
      { id: 'progress', label: 'Progress', icon: BarChart3, route: 'home' as Route },
      { id: 'you', label: 'You', icon: UserRound, route: 'home' as Route },
    ],
    [],
  );

  return (
    <nav className="k3-tabbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            className={active === tab.id ? 'is-active' : ''}
            onClick={() => goto(tab.route)}
          >
            <Icon size={19} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
