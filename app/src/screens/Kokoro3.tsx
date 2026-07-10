import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  Clock3,
  CornerDownLeft,
  Home,
  Library,
  Loader2,
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
import { flushSync } from 'react-dom';
import { useConversation } from '@elevenlabs/react';
import { ELEVENLABS_AGENT_ID, friendlyApiError } from '../lib/config';
import {
  friendlyAppleSignInError,
  isAppleSignInAvailable,
  isAppleSignInCanceled,
  signInWithApple,
} from '../lib/appleSignIn';
import type { Route } from '../lib/router';
import { getConversationSignedUrl } from '../lib/elevenlabs';
import { logAudioRoute } from '../lib/audioRouteDiagnostics';
import { enterPlaybackMode, exitPlaybackMode } from '../lib/playbackSession';
import { cleanText, hasCompletedLocalProfile } from '../lib/profile';
import {
  logAudioElements,
  nudgeConversationAudioElements,
  startConversationAudioElementNudge,
} from '../lib/audioElementDiagnostics';
import { stopAudioStream, unlockAudio } from '../lib/audioUnlock';
import { isLibraryAvailable } from '../lib/library';
import { isProtectedWebClient } from '../lib/platform';
import type { LibraryItem } from '../lib/types-meditation';
import { haptic } from '../lib/telegram';
import type { Answers, Persona, Vibe } from '../types';
import { useAnswers } from '../state/answers';
import { authApi } from '../state/auth';
import { personaApi, usePersona } from '../state/persona';
import {
  ALL_VIBES,
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
import { useWebAuth, webAuthApi } from '../state/webAuth';
import { pwaApi, usePwa } from '../state/pwa';

const A = '/kokoro3/';

// Support / content-report contact (Guideline 1.2) — a monitored inbox.
const SUPPORT_EMAIL = 'dan@aiboostly.com';
const PRIVACY_URL = 'https://kokoromind.com/privacy.html';
const TERMS_URL = 'https://kokoromind.com/terms.html';

const SOFT_NAMES = ['Love', 'Babe', 'Honey', 'Baby', 'Sweetheart', 'Sunshine', 'Kitten'];

// True only on the native tablet (iPad) build at tablet width — used to opt the
// chat screen into the iPad-only "Kokoro's words stay up top, the generating bar
// drops to the bottom" layout, leaving the iPhone layout completely untouched.
function useIsPadNative(): boolean {
  const query = '(min-width: 601px)';
  const read = () =>
    typeof window !== 'undefined' &&
    !!window.matchMedia?.(query).matches &&
    document.documentElement.classList.contains('is-native');
  const [isPad, setIsPad] = useState<boolean>(read);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const update = () => setIsPad(read());
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return isPad;
}
const MAIN_GOALS = [
  'Calm me down',
  'Help me sleep',
  'Give me confidence',
  'Let me talk it out',
  'Show me my future self',
  "I don't know",
];
const SOURCES = ['Work', 'Someone close', 'My head', 'My body', 'Money', 'The future', 'Family', 'No idea'];

const CHAT_FIRST_MESSAGE_KEY = 'kokoro3_chat_first_message';
const CHAT_RETURN_ROUTE_KEY = 'kokoro3_chat_return_route';

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

const SHORT_VIBE_COPY: Record<Vibe, string> = {
  raw: 'Unfiltered, real talk',
  cosmic: 'Soft and symbolic',
  iron: 'Grounded pressure release',
  sleep: 'Slow wind-down',
  zen: 'Quiet breath-led calm',
};

function voiceElapsed(startedAt: number | null): number | undefined {
  return startedAt === null ? undefined : Math.round(performance.now() - startedAt);
}

const CAPTURE_FIELD_LABELS = [
  'User name',
  'Call them',
  'How they are carrying today',
  'Where it seems to be coming from',
  'What they told Kokoro',
];

function buildWeCanPhrase(mainGoal: string, source: string): string {
  const clause = GOAL_CLAUSE[mainGoal] || 'sit with whatever this is';
  const tail = SOURCE_TAIL[source] ?? '';
  return `${clause}${tail}`;
}

function returningTalkMessage(answers: Answers): string {
  const name = (answers.callMe || answers.realName || 'friend').trim();
  return `It's good to see you again ${name}! Want to talk about something that's on your mind?`;
}

function isIosWebKitRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform || '';
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function defaultVoiceFirstMessage(answers: Answers): string {
  const weCanPhrase = buildWeCanPhrase(answers.feeling || '', answers.source || '');
  return `Hey love, I'm Kokoro. I can help you with whatever you're going through. We can ${weCanPhrase}.`;
}

function coldStartVoiceFirstMessage(message: string): string {
  const withoutDefaultGreeting = message.replace(/^Hey love,\s*I'm Kokoro\.\s*/i, '');
  return `Mmm... heeeyyy, I'm Kokoro. ${withoutDefaultGreeting}`;
}

function setChatEntry({
  firstMessage,
  returnRoute,
}: {
  firstMessage?: string;
  returnRoute: Route;
}) {
  try {
    if (firstMessage) sessionStorage.setItem(CHAT_FIRST_MESSAGE_KEY, firstMessage);
    else sessionStorage.removeItem(CHAT_FIRST_MESSAGE_KEY);
    sessionStorage.setItem(CHAT_RETURN_ROUTE_KEY, returnRoute);
  } catch {
    /* session storage unavailable */
  }
}

function takeChatFirstMessage(): string | null {
  try {
    const value = sessionStorage.getItem(CHAT_FIRST_MESSAGE_KEY);
    sessionStorage.removeItem(CHAT_FIRST_MESSAGE_KEY);
    return value;
  } catch {
    return null;
  }
}

function readChatReturnRoute(): Route {
  try {
    const value = sessionStorage.getItem(CHAT_RETURN_ROUTE_KEY);
    if (
      value === 'home' ||
      value === 'quickReset' ||
      value === 'sleep' ||
      value === 'library' ||
      value === 'progress' ||
      value === 'you' ||
      value === 'source'
    ) {
      return value;
    }
  } catch {
    /* session storage unavailable */
  }
  return 'source';
}

function openReturningChat(goto: (r: Route) => void, answers: Answers, returnRoute: Route = 'home') {
  haptic.medium();
  setChatEntry({ firstMessage: returningTalkMessage(answers), returnRoute });
  goto('chat');
}

function nextRouteAfterAppleSignIn(answers: Answers, persona: Persona): Route {
  if (hasCompletedLocalProfile(answers, persona)) return 'home';
  if (!cleanText(answers.callMe || answers.realName || persona.callMe || persona.realName)) return 'name';
  if (!cleanText(answers.feeling)) return 'feeling';
  if (!cleanText(answers.source)) return 'source';
  return 'chat';
}

const VIBE_CARDS: Record<Vibe, {
  title: string;
  eyebrow: string;
  copy: string;
  accent: string;
  image: string;
  thumb: string;
  poster: string;
}> = {
  raw: {
    title: 'Gen Z',
    eyebrow: 'raw - unfiltered',
    copy: 'No notes. Just real. Uses casual language and may swear.',
    accent: '#fc6708',
    image: 'kokoro-proud.mp4',
    thumb: 'thumb-kokoro-proud.m4v',
    poster: 'kokoro-meditate.png',
  },
  cosmic: {
    title: 'Spiritual',
    eyebrow: 'cosmic - mystic',
    copy: 'Soft, symbolic, a little lunar. Good for bigger feelings.',
    accent: '#8f8d3a',
    image: 'kokoro-float.mp4',
    thumb: 'thumb-kokoro-float.m4v',
    poster: 'kokoro-float.png',
  },
  iron: {
    title: 'Drive',
    eyebrow: 'iron - direct',
    copy: 'Grounded pressure release. Less soft, more backbone.',
    accent: '#d56e25',
    image: 'kokoro-heart.mp4',
    thumb: 'thumb-kokoro-heart.m4v',
    poster: 'Kokoro-Standing-still.png',
  },
  sleep: {
    title: 'Wind down',
    eyebrow: 'bedtime - slow',
    copy: 'Low and gentle for letting the day leave your body.',
    accent: '#71804b',
    image: 'kokoro-meditate.mp4',
    thumb: 'thumb-kokoro-meditate.m4v',
    poster: 'kokoro-meditate.png',
  },
  zen: {
    title: 'Zen',
    eyebrow: 'still - clear',
    copy: 'Clean, quiet, breath-led. The safest default.',
    accent: '#64764e',
    image: 'kokoro-tea.mp4',
    thumb: 'thumb-kokoro-tea.m4v',
    poster: 'kokoro-meditate.png',
  },
};

// Safe VIBE_CARDS accessor. Keys coming from the backend stream
// (result.vibe / generated.vibe — JSON.parse'd with no runtime validation) or
// from persisted localStorage (item.vibe / a stale answers.vibe) may fall
// outside the 5-key union. A bare VIBE_CARDS[badKey] is undefined and reading
// .title/.thumb/etc throws during render → blank screen. Default to zen.
const vibeCard = (v: string | undefined | null) => VIBE_CARDS[v as Vibe] ?? VIBE_CARDS.zen;
const TYPED_MEDITATION_PROMPT =
  "Okay. I have enough to shape this into something useful. Choose how it should land.";

function typedMessageLooksLikeGreeting(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[!.?,\s]+$/g, '');
  return /^(hey|hi|hello|hii|hiya|yo|sup|heyy|hey kokoro|hi kokoro|hello kokoro)$/.test(normalized);
}

function typedMessageAsksForMeditation(text: string): boolean {
  const normalized = text.toLowerCase();
  return /\b(make it|turn this|i'?m ready|ready|help me sleep|calm me down|wind me down)\b/.test(normalized)
    || (
      /\b(make|create|generate|start|give me|need|want|please)\b/.test(normalized)
      && /\b(meditation|meditate|calm|sleep|wind down|reset|ground|breathe|breath)\b/.test(normalized)
    );
}

// Typed-only guard: an informational / exploratory message ("tell me more about
// meditation", "what is this", "how does it work", "why meditate") should reach
// the agent so it can explain and *offer* to make one — not trip the turn-count
// shortcut below that tears down the session and jumps straight to the style
// cards. Voice has no such shortcut, which is why voice already behaves this way.
function typedMessageIsInfoSeeking(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (normalized.includes('?')) return true;
  return /\b(tell me more|more about|what'?s|what is|what are|how (?:do|does|can|would|long)|why|explain|curious|wondering|wonder|learn|teach me|do you|does it|is it|are there)\b/.test(normalized);
}

function typedFollowupFor(text: string): string {
  const clean = text.trim();

  if (typedMessageLooksLikeGreeting(clean)) {
    return "Hey. I'm here with you. Tell me what's been on your mind today.";
  }

  if (clean.length < 18) {
    return 'I hear you. Give me one real sentence about what is happening, and I will stay with it.';
  }

  if (/\?/.test(clean) && /\b(meditation|meditate|benefit|benefits|why)\b/i.test(clean)) {
    return "Meditation can help your body slow down enough to actually hear yourself. Tell me what's going on for you, and I can shape one around it.";
  }

  return 'Okay, I am with you. What is the hardest part of that right now?';
}

type ScreenProps = { goto: (r: Route) => void };
type ChatMessage = { id: string; role: 'kokoro' | 'user' | 'system'; text: string };

function FadingBubble({ role, message }: { role: 'kokoro' | 'user'; message: ChatMessage | undefined }) {
  const [displayed, setDisplayed] = useState<{ id: string; text: string } | null>(
    message ? { id: message.id, text: message.text } : null,
  );
  const [leaving, setLeaving] = useState(false);
  const pendingRef = useRef<{ id: string; text: string } | null>(null);
  const timerRef = useRef<number | null>(null);
  const messageId = message?.id;
  const messageText = message?.text;

  /* FadingBubble keeps the previous message mounted long enough to animate out. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!messageId || messageText === undefined) return;
    if (displayed && displayed.id === messageId) {
      pendingRef.current = null;
      return;
    }

    if (!displayed) {
      setDisplayed({ id: messageId, text: messageText });
      return;
    }

    pendingRef.current = { id: messageId, text: messageText };

    if (timerRef.current !== null) return;

    setLeaving(true);
    timerRef.current = window.setTimeout(() => {
      const next = pendingRef.current;
      timerRef.current = null;
      pendingRef.current = null;
      if (next) setDisplayed(next);
      setLeaving(false);
    }, 240);
  }, [messageId, messageText, displayed]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
  play = true,
}: {
  file: string;
  className?: string;
  poster?: string;
  play?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const posterSrc = poster ? `${A}${poster}` : `${A}kokoro-meditate.png`;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (play) {
      void v.play().catch(() => {});
    } else {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        /* video not yet seekable */
      }
    }
  }, [play]);

  return (
    <div className={`k3-mascot-video ${videoReady ? 'is-video-ready' : ''} ${className}`}>
      <img src={posterSrc} alt="" draggable={false} />
      <video
        ref={videoRef}
        className={videoReady ? 'is-ready' : ''}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={posterSrc}
        onLoadedData={(event) => {
          setVideoReady(true);
          if (!play) {
            event.currentTarget.pause();
            event.currentTarget.currentTime = 0;
          }
        }}
        onCanPlay={() => setVideoReady(true)}
        onPlaying={() => setVideoReady(true)}
        onError={() => setVideoReady(false)}
      >
        <source src={`${A}${file}`} type="video/mp4" />
      </video>
    </div>
  );
}

function InlineLoopVideo({
  file,
  poster,
  className = '',
}: {
  file: string;
  poster: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || failed) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const attempt = video.play();
    if (attempt) {
      void attempt
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [failed]);

  useEffect(() => {
    tryPlay();

    const retry = () => {
      if (document.visibilityState !== 'hidden') tryPlay();
    };

    document.addEventListener('visibilitychange', retry);
    window.addEventListener('focus', retry);
    window.addEventListener('pointerdown', retry, { passive: true });
    window.addEventListener('touchstart', retry, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', retry);
      window.removeEventListener('focus', retry);
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('touchstart', retry);
    };
  }, [tryPlay]);

  return (
    <div className={`k3-loop-video ${isPlaying ? 'is-playing' : ''} ${failed ? 'is-failed' : ''} ${className}`}>
      <img src={`${A}${poster}`} alt="" draggable={false} />
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={`${A}${poster}`}
        disablePictureInPicture
        onLoadedData={tryPlay}
        onCanPlay={tryPlay}
        onPlaying={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onStalled={() => setIsPlaying(false)}
        onError={() => {
          setFailed(true);
          setIsPlaying(false);
        }}
      >
        <source src={`${A}${file}`} type="video/mp4" />
      </video>
    </div>
  );
}

function PeekVideo({
  file,
  loopFile,
  stillImage,
  poster,
  active = true,
  variant = 'feather',
  className = '',
}: {
  file: string;
  loopFile?: string;
  stillImage?: string;
  poster?: string;
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
  const [introReady, setIntroReady] = useState(false);
  const [loopReady, setLoopReady] = useState(false);
  const loopRef = useRef<HTMLVideoElement | null>(null);
  const fallbackImage = stillImage || poster || 'kokoro-peak.png';

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
      <div className={`k3-peek-wrap ${introReady ? 'is-video-ready' : ''} ${variantClass} ${className}`}>
        <img src={`${A}${fallbackImage}`} alt="" draggable={false} />
        <video
          className={introReady ? 'is-ready' : ''}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={`${A}${fallbackImage}`}
          onLoadedData={() => setIntroReady(true)}
          onCanPlay={() => setIntroReady(true)}
          onPlaying={() => setIntroReady(true)}
          onError={() => setIntroReady(false)}
        >
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
      <img
        src={`${A}${fallbackImage}`}
        alt=""
        draggable={false}
        style={{ ...layerStyle, opacity: !introReady || (showLoop && !loopReady) || (introDone && !showLoop && !showStill) ? 1 : 0 }}
      />
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        poster={`${A}${fallbackImage}`}
        onEnded={() => {
          setIntroDone(true);
          const v = loopRef.current;
          if (v && active) {
            v.currentTime = 0;
            void v.play().catch(() => {});
          }
        }}
        onLoadedData={() => setIntroReady(true)}
        onCanPlay={() => setIntroReady(true)}
        onPlaying={() => setIntroReady(true)}
        onError={() => setIntroReady(false)}
        style={{ ...layerStyle, opacity: introReady && !introDone ? 1 : 0 }}
      >
        <source src={`${A}${file}`} type="video/mp4" />
      </video>
      <video
        ref={loopRef}
        loop
        muted
        playsInline
        preload="auto"
        poster={`${A}${fallbackImage}`}
        onLoadedData={() => setLoopReady(true)}
        onCanPlay={() => setLoopReady(true)}
        onPlaying={() => setLoopReady(true)}
        onError={() => setLoopReady(false)}
        style={{ ...layerStyle, opacity: showLoop && loopReady ? 1 : 0 }}
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
  const [videoReady, setVideoReady] = useState(false);
  const posterSrc = poster ? `${A}${poster}` : `${A}kokoro-meditate.png`;

  return (
    <div className={`k3-blended-video ${videoReady ? 'is-video-ready' : ''} ${className}`}>
      <img src={posterSrc} alt="" draggable={false} />
      <video
        className={videoReady ? 'is-ready' : ''}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={posterSrc}
        onLoadedData={() => setVideoReady(true)}
        onCanPlay={() => setVideoReady(true)}
        onPlaying={() => setVideoReady(true)}
        onError={() => setVideoReady(false)}
      >
        <source src={`${A}${file}`} type="video/mp4" />
      </video>
    </div>
  );
}

export function Welcome3({ goto }: ScreenProps) {
  const { answers, reset, setAnswer } = useAnswers();
  const [appleBusy, setAppleBusy] = useState(false);
  const [appleError, setAppleError] = useState('');

  const appleAvailable = isAppleSignInAvailable();

  const handleAppleSignIn = async () => {
    setAppleError('');
    setAppleBusy(true);
    try {
      const personaBeforeSignIn = personaApi.getSnapshot();
      const nextRoute = nextRouteAfterAppleSignIn(answers, personaBeforeSignIn);
      const { account } = await signInWithApple();
      authApi.setAppleAccount(account);

      // Apple gives given + family; we only want the first name in the name
      // field, and the pet name (callMe) deliberately left empty for the user
      // to choose. personaApi.set merges, so omitting callMe leaves it untouched.
      const firstName = account.givenName || '';
      if (firstName) {
        setAnswer('realName', firstName);
        personaApi.set({ realName: firstName });
      }

      goto(nextRoute);
    } catch (error) {
      if (!isAppleSignInCanceled(error)) {
        setAppleError(friendlyAppleSignInError(error));
      }
    } finally {
      setAppleBusy(false);
    }
  };

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
        {appleAvailable && (
          <button
            className="k3-apple-sign-in"
            disabled={appleBusy}
            onClick={() => {
              haptic.light();
              void handleAppleSignIn();
            }}
          >
            <svg className="k3-apple-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            <span>{appleBusy ? 'Opening Apple...' : 'Sign in with Apple'}</span>
          </button>
        )}
        {appleError && <p className="k3-auth-error" role="alert">{appleError}</p>}
        <button className="k3-link" onClick={() => goto('home')}>Continue without signing in</button>
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
  const initialSoft = answers.callMe || '';
  const isPresetSoft = SOFT_NAMES.includes(initialSoft);
  const [softName, setSoftName] = useState(initialSoft);
  const [customPet, setCustomPet] = useState(isPresetSoft ? '' : initialSoft);
  const [customPetActive, setCustomPetActive] = useState(!isPresetSoft && initialSoft.length > 0);
  const [hasStartedTyping, setHasStartedTyping] = useState(name.length > 0);
  const [petInputFocused, setPetInputFocused] = useState(false);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const customPetRef = useRef<HTMLInputElement | null>(null);

  const canContinue = name.trim().length > 0;
  const customSelected = customPetActive && customPet.length > 0 && softName === customPet;

  const handleOpenCustomPet = () => {
    flushSync(() => setCustomPetActive(true));
    customPetRef.current?.focus();
  };

  return (
    <Frame className={`k3-name ${petInputFocused ? 'k3-pet-typing' : ''}`}>
      <BackButton onClick={() => goto('welcome')} />

      <div className="k3-name-mascot">
        <MascotVideo file="kokoro-proud.mp4" play={hasStartedTyping} />
      </div>

      <section className="k3-center-copy k3-name-copy">
        <h2>Before we start -<br />what should I call you?</h2>
      </section>

      <div className="k3-name-field">
        <input
          ref={nameInputRef}
          className="k3-name-input"
          value={name}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setName(next);
            if (!hasStartedTyping && next.length > 0) setHasStartedTyping(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          placeholder="Your name..."
          maxLength={60}
          enterKeyHint="done"
        />
        <button
          type="button"
          className="k3-name-done"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => nameInputRef.current?.blur()}
          aria-label="Done"
          title="Done"
        >
          <CornerDownLeft size={18} strokeWidth={2.4} />
        </button>
      </div>

      <section className="k3-chip-section">
        <p className="k3-soft-helper">
          It really helps us make better connection if we can call you something really personal. Imagine how would your loved one or your parent call you?
        </p>
        <div className="k3-chip-grid">
          {SOFT_NAMES.map((label) => (
            <button
              key={label}
              className={`k3-chip ${softName === label && !customSelected ? 'is-selected' : ''}`}
              onClick={() => setSoftName(label)}
            >
              {label}
            </button>
          ))}
          {customPetActive ? (
            <label className={`k3-chip k3-chip-custom ${customSelected ? 'is-selected' : ''}`}>
              <input
                ref={customPetRef}
                type="text"
                placeholder="Your pet-name?"
                value={customPet}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setCustomPet(next);
                  setSoftName(next);
                }}
                onFocus={() => {
                  setPetInputFocused(true);
                  if (customPet.length > 0) setSoftName(customPet);
                }}
                onBlur={() => setPetInputFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                maxLength={40}
                enterKeyHint="done"
              />
            </label>
          ) : (
            <button
              type="button"
              className="k3-chip k3-chip-dashed"
              onClick={handleOpenCustomPet}
            >
              + Your own...
            </button>
          )}
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
            setChatEntry({ returnRoute: 'source' });
            goto('chat');
          }}
        >
          Tell Kokoro
        </PrimaryButton>
      </div>
    </Frame>
  );
}

export function Promise3({ goto }: ScreenProps) {
  const { answers, setAnswer } = useAnswers();
  const [reminderTime, setReminderTime] = useState(answers.reminderTime || '20:00');

  const programPhrase = buildWeCanPhrase(answers.feeling || '', answers.source || '');

  const commitProgram = () => {
    setAnswer('reminderTime', reminderTime);
    setAnswer('wantsProgram', true);
    goto('home');
  };

  return (
    <Frame className="k3-promise">
      <BackButton onClick={() => goto('player')} />
      <PeekVideo file="kokoro-peak.mp4" variant="right" className="k3-promise-peek" />

      <div className="k3-speech-bubble k3-promise-bubble">
        <strong>I can build you a<br />14-day program -</strong>
        <span>we'll work on {programPhrase}.</span>
      </div>

      <section className="k3-promise-copy">
        <h2>Whatever you tell me stays here.<br />I won't try to fix you.<br />I'll just listen - and make you something.</h2>
      </section>

      <div className="k3-reminder">
        <div className="k3-reminder-icon"><Clock3 size={19} /></div>
        <div>
          <strong>Gentle daily reminder</strong>
          <span>Skippable - set it later.</span>
        </div>
        <input
          type="time"
          className="k3-reminder-time"
          value={reminderTime}
          onChange={(event) => setReminderTime(event.currentTarget.value)}
          aria-label="Daily reminder time"
        />
      </div>

      <ScenicFloor />
      <div className="k3-bottom-cta">
        <ProgressDots active={4} />
        <PrimaryButton onClick={commitProgram}>Make me a program.</PrimaryButton>
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

// Live progress model for the "making" card. Anchored to the real stream phases
// (starting -> script -> streaming -> ready) but eased over elapsed time within
// each phase, so the bar always inches forward and never sits at a fake "100%".
// Bands are deliberately conservative: the long Suno wait sits mid-bar (~70%),
// not "almost done", so a slow generation doesn't read as stuck-at-the-end.
const PHASE_BANDS: Record<string, { floor: number; ceil: number; typicalMs: number }> = {
  starting: { floor: 0.04, ceil: 0.2, typicalMs: 8000 },
  script: { floor: 0.2, ceil: 0.72, typicalMs: 50000 },
  streaming: { floor: 0.72, ceil: 0.96, typicalMs: 45000 },
  ready: { floor: 1, ceil: 1, typicalMs: 0 },
};

const TOTAL_TYPICAL_MS = 120000; // ~2 min typical end-to-end; the ETA is a soft hint.

function progressFor(phase: string, elapsedInPhaseMs: number): number {
  if (phase === 'ready') return 1;
  const band = PHASE_BANDS[phase] ?? PHASE_BANDS.starting;
  const span = band.ceil - band.floor;
  const k = elapsedInPhaseMs / Math.max(band.typicalMs, 1);
  const eased = 1 - Math.exp(-1.9 * k); // 0 -> ~0.85 at k=1, asymptotes toward ceil
  return Math.min(band.floor + span * eased, band.ceil - 0.005); // never reach ceil
}

function etaLabel(etaMs: number, pct: number): string {
  if (pct >= 1) return 'ready';
  if (etaMs > 90000) return '~2 min left';
  if (etaMs > 45000) return '~1 min left';
  if (etaMs > 15000) return 'under a minute…';
  return 'almost there…';
}

function MakingProgress({ phase, startedAt }: { phase: string; startedAt: number }) {
  // Initial frame is static (no clock reads during render — keeps the component
  // pure). The interval below takes over within 400ms with the live values.
  const [tick, setTick] = useState<{ pct: number; etaMs: number }>(() => ({
    pct: progressFor(phase, 0),
    etaMs: TOTAL_TYPICAL_MS,
  }));

  useEffect(() => {
    // The per-phase clock starts when this effect (re)runs — i.e. on mount and
    // whenever `phase` changes — so the band eases from the moment the phase began.
    const phaseStart = Date.now();
    const id = window.setInterval(() => {
      const inPhase = Date.now() - phaseStart;
      const etaMs =
        phase === 'ready' || startedAt <= 0
          ? 0
          : Math.max(TOTAL_TYPICAL_MS - (Date.now() - startedAt), 0);
      setTick({ pct: progressFor(phase, inPhase), etaMs });
    }, 400);
    return () => window.clearInterval(id);
  }, [phase, startedAt]);

  const pct100 = Math.round(tick.pct * 100);
  return (
    <>
      <div className="k3-making-progress" data-phase={phase} aria-hidden="true">
        <span style={{ width: `${pct100}%` }} />
      </div>
      <div className="k3-making-eta">{pct100}% · {etaLabel(tick.etaMs, tick.pct)}</div>
    </>
  );
}

export function Chat3({ goto }: ScreenProps) {
  const { answers, setAnswer } = useAnswers();
  const [entryFirstMessage] = useState(() => takeChatFirstMessage());
  const [chatReturnRoute] = useState<Route>(() => readChatReturnRoute());
  // Guideline 5.1.2(i): get explicit consent before any voice/text is sent to
  // third-party AI (ElevenLabs / LLM / Suno). Shown once, then remembered.
  const [aiConsent, setAiConsent] = useState(() => {
    try {
      return localStorage.getItem('kokoro_ai_consent') === '1';
    } catch {
      return false;
    }
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => (
    entryFirstMessage
      ? [{ id: 'entry-first-message', role: 'kokoro', text: entryFirstMessage }]
      : [
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
        ]
  ));
  const [draft, setDraft] = useState('');
  const [showStyles, setShowStyles] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('kokoro_chat_show_styles') === '1';
    } catch {
      return false;
    }
  });
  const [suggestedVibe, setSuggestedVibe] = useState<Vibe | null>(() => {
    try {
      const raw = sessionStorage.getItem('kokoro_chat_suggested_vibe');
      if (!raw) return null;
      return (ALL_VIBES as readonly string[]).includes(raw) ? (raw as Vibe) : null;
    } catch {
      return null;
    }
  });
  // A *fresh* conversation — any entry that set its own opening line via
  // setChatEntry ("Talk to Kokoro", 60-second reset, Wind down, "make one in X
  // style") — must start with no selected vibe. Otherwise the persisted
  // answers.vibe + byVibe record from a previously-finished meditation
  // resurfaces its result card in the new session (the reported stale-card bug).
  // Returning to the chat you were already in (e.g. the Player back button, which
  // sets no entry message) keeps answers.vibe so your just-made meditation shows.
  const [selectedVibe, setSelectedVibe] = useState<Vibe | ''>(
    entryFirstMessage ? '' : (answers.vibe || ''),
  );
  const [agentError, setAgentError] = useState<string | null>(null);
  const [startingVoice, setStartingVoice] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [mascotEmotion, setMascotEmotion] = useState<'warm' | 'surprised'>('warm');
  const [conversationKind, setConversationKind] = useState<'voice' | 'text' | null>(null);
  const messagesRef = useRef(messages);
  const seenEventsRef = useRef(new Set<string>());
  const announcedResultRef = useRef(false);
  const voiceStartAtRef = useRef<number | null>(null);
  const firstAgentTextAtRef = useRef<number | null>(null);
  const firstSpeakingAtRef = useRef<number | null>(null);
  const firstAudioChunkAtRef = useRef<number | null>(null);
  const audioChunkCountRef = useRef(0);
  const audioChunkBytesRef = useRef(0);
  const firstVolumeProbeAtRef = useRef<number | null>(null);
  const firstOutputVolumeAtRef = useRef<number | null>(null);
  const lateZeroOutputRouteAtRef = useRef<number | null>(null);
  const voicePrewarmStreamRef = useRef<MediaStream | null>(null);
  const voicePrewarmRunRef = useRef(0);
  const stopVoiceAudioElementNudgeRef = useRef<(() => void) | null>(null);
  const coldVoiceIntroUsedRef = useRef(false);
  const pendingTextMessageRef = useRef<string | null>(null);
  // True while the mic button is held (push-to-talk). Drives mute on connect.
  const wantMicLiveRef = useRef(false);
  // Set when the user releases during 'connecting'; the connect effect flushes it.
  const pendingMuteRef = useRef(false);
  // Set when the mic is pressed while a text session is open. The text session is
  // torn down first; voice is then opened from onDisconnect, so the old session's
  // late onDisconnect can't clobber the new voice session's conversationKind.
  const startVoiceAfterTeardownRef = useRef(false);
  // The kind of the session we last intended to start. onConnect re-asserts
  // conversationKind from this, so a prior session's late onDisconnect (which
  // nulls conversationKind) can never leave a freshly-connected session in the
  // wrong kind — the authoritative-on-connect guard for the text<->voice swap.
  const intendedKindRef = useRef<'voice' | 'text' | null>(null);
  const stylePanelRef = useRef<HTMLDivElement | null>(null);
  const [dismissedErrorVibes, setDismissedErrorVibes] = useState<Set<Vibe>>(() => new Set());

  useEffect(() => {
    if (showStyles && stylePanelRef.current) {
      stylePanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showStyles]);

  useEffect(() => {
    try {
      sessionStorage.setItem('kokoro_chat_show_styles', showStyles ? '1' : '0');
    } catch {
      /* session storage unavailable */
    }
  }, [showStyles]);

  // Leaving the chat screen should dismiss the style picker — otherwise it's
  // persisted in sessionStorage and pops back up next time chat mounts.
  useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem('kokoro_chat_show_styles');
      } catch {
        /* session storage unavailable */
      }
    };
  }, []);

  useEffect(() => {
    try {
      if (suggestedVibe) sessionStorage.setItem('kokoro_chat_suggested_vibe', suggestedVibe);
      else sessionStorage.removeItem('kokoro_chat_suggested_vibe');
    } catch {
      /* session storage unavailable */
    }
  }, [suggestedVibe]);

  const progress = useMeditationProgress();
  const byVibe = useGeneratedMeditationsByVibe();
  const library = useLibrary();
  const progressSlot = selectedVibe ? progress[selectedVibe] : undefined;
  const phase = progressSlot?.phase ?? 'idle';
  const generationError = progressSlot?.error;
  const generationStartedAt = progressSlot?.startedAt ?? 0;
  const result = selectedVibe ? byVibe[selectedVibe] : undefined;
  const isGeneratingMeditation = Boolean(selectedVibe && phase !== 'idle' && phase !== 'error' && !result);
  const isPadNative = useIsPadNative();

  // The white "generating" card. On BOTH iPhone and iPad it now drops into the
  // same lower slot the orange result card uses (iPhone -> .k3-making-bar, iPad
  // -> .k3-pad-making-bar), so Kokoro's words stay visible up top and the white
  // box hands off to the orange card in place, at the same size.
  const makingCard = (
    <div className="k3-making-card">
      <div style={{ flex: 1, minWidth: 0 }}>
        <span>{phaseLabel(phase)}</span>
        <strong>{vibeCard(selectedVibe).title}</strong>
      </div>
      {phase === 'ready' ? <Check size={18} /> : <Wind size={18} />}
      <MakingProgress phase={phase} startedAt={generationStartedAt} />
    </div>
  );

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

  const stopVoicePrewarm = useCallback((delayMs = 0) => {
    const run = ++voicePrewarmRunRef.current;
    const stop = () => {
      if (run !== voicePrewarmRunRef.current) return;
      stopAudioStream(voicePrewarmStreamRef.current);
      voicePrewarmStreamRef.current = null;
      console.log('[audio] mic route prewarm stopped', {
        elapsedMs: voiceElapsed(voiceStartAtRef.current),
      });
      logAudioRoute('voice.prewarm.stopped', voiceElapsed(voiceStartAtRef.current));
    };
    if (delayMs > 0) {
      window.setTimeout(stop, delayMs);
    } else {
      stop();
    }
  }, []);

  const stopVoiceAudioElementNudge = useCallback(() => {
    stopVoiceAudioElementNudgeRef.current?.();
    stopVoiceAudioElementNudgeRef.current = null;
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

      if (!isUser && voiceStartAtRef.current !== null && firstAgentTextAtRef.current === null) {
        firstAgentTextAtRef.current = performance.now();
        console.log('[11labs] first agent text', {
          elapsedMs: voiceElapsed(voiceStartAtRef.current),
          eventId: payload.event_id,
        });
        logAudioRoute('voice.first-agent-text', voiceElapsed(voiceStartAtRef.current), {
          eventId: payload.event_id,
        });
      }

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
      setStartingVoice(false);
      setConversationKind(null);
      setAgentError(friendlyApiError(text || context || 'unknown agent error'));
    },
    onConnect: (info) => {
      console.log('[11labs] onConnect', {
        ...info,
        elapsedMs: voiceElapsed(voiceStartAtRef.current),
      });
      // Authoritative on connect: a prior session's late onDisconnect may have
      // nulled conversationKind after we set it (text<->voice swap). Heal it from
      // the kind we actually started, so mic/mute logic always sees the truth.
      if (intendedKindRef.current) setConversationKind(intendedKindRef.current);
      nudgeConversationAudioElements('voice.on-connect', voiceElapsed(voiceStartAtRef.current));
      logAudioRoute('voice.on-connect', voiceElapsed(voiceStartAtRef.current), {
        conversationId: typeof info.conversationId === 'string' ? info.conversationId : undefined,
      });
      stopVoicePrewarm(2500);
      setStartingVoice(false);
      const pendingText = pendingTextMessageRef.current;
      if (pendingText) {
        pendingTextMessageRef.current = null;
        window.setTimeout(() => {
          try {
            void sendUserMessage(pendingText);
          } catch (error) {
            console.error('[11labs] send pending typed message failed', error);
            appendMessage('kokoro', typedFollowupFor(pendingText));
          }
        }, 0);
      }
    },
    onDisconnect: (details) => {
      console.log('[11labs] onDisconnect', details);
      stopVoiceAudioElementNudge();
      logAudioRoute('voice.on-disconnect', voiceElapsed(voiceStartAtRef.current), {
        details,
      });
      stopVoicePrewarm();
      setConversationKind(null);
      // The mic was pressed while a text session was open: now that it's fully
      // torn down, open the voice session (audio was already unlocked inside the
      // tap gesture). Deferring to here avoids this disconnect racing the new
      // voice session's conversationKind. setTimeout(0) lets this callback settle.
      // Keep startingVoice true across the handoff so the mic stays 'connecting'.
      if (startVoiceAfterTeardownRef.current) {
        // Keep the ref SET across this tick so a mic press in the gap before the
        // deferred start is still guarded; the deferred callback (or the 600ms
        // safety net, whichever runs first) clears it exactly once and starts
        // voice exactly once. Clearing it here would briefly open the guard and
        // let a stray press start a second session.
        window.setTimeout(() => {
          if (startVoiceAfterTeardownRef.current) {
            startVoiceAfterTeardownRef.current = false;
            void beginVoiceSession();
          }
        }, 0);
      } else {
        setStartingVoice(false);
      }
    },
    onStatusChange: (info) => {
      console.log('[11labs] onStatusChange', info);
      if (voiceStartAtRef.current !== null) {
        if (info.status === 'connected' || info.status === 'connecting') {
          nudgeConversationAudioElements(`voice.status-${info.status}`, voiceElapsed(voiceStartAtRef.current));
        }
        logAudioRoute('voice.status-change', voiceElapsed(voiceStartAtRef.current), info);
      }
    },
    onModeChange: (info) => {
      if (
        info.mode === 'speaking' &&
        voiceStartAtRef.current !== null &&
        firstSpeakingAtRef.current === null
      ) {
        firstSpeakingAtRef.current = performance.now();
        console.log('[11labs] first speaking mode', {
          elapsedMs: voiceElapsed(voiceStartAtRef.current),
        });
        logAudioRoute('voice.first-speaking-mode', voiceElapsed(voiceStartAtRef.current));
      }
      console.log('[11labs] onModeChange', info);
    },
    onAudio: (base64Audio) => {
      audioChunkCountRef.current += 1;
      audioChunkBytesRef.current += base64Audio.length;
      if (voiceStartAtRef.current !== null && firstAudioChunkAtRef.current === null) {
        firstAudioChunkAtRef.current = performance.now();
        console.log('[11labs] first audio chunk', {
          elapsedMs: voiceElapsed(voiceStartAtRef.current),
          base64Length: base64Audio.length,
        });
        nudgeConversationAudioElements('voice.first-audio-chunk', voiceElapsed(voiceStartAtRef.current));
        logAudioRoute('voice.first-audio-chunk', voiceElapsed(voiceStartAtRef.current), {
          base64Length: base64Audio.length,
        });
      }
      if (audioChunkCountRef.current <= 5 || audioChunkCountRef.current % 10 === 0) {
        console.log('[11labs] audio chunk', {
          elapsedMs: voiceElapsed(voiceStartAtRef.current),
          count: audioChunkCountRef.current,
          totalBase64Length: audioChunkBytesRef.current,
          base64Length: base64Audio.length,
        });
      }
    },
    onInterruption: (info) => {
      console.log('[11labs] onInterruption', {
        elapsedMs: voiceElapsed(voiceStartAtRef.current),
        info,
      });
      logAudioRoute('voice.interruption', voiceElapsed(voiceStartAtRef.current), { info });
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
    getInputVolume,
    getOutputVolume,
  } = conversation;

  type StartSessionOptions = Record<string, unknown> & {
    overrides?: {
      agent?: { firstMessage?: string };
      conversation?: { textOnly?: boolean };
    };
    onConnect?: () => void;
  };

  const buildSessionOptions = (
    kind: 'voice' | 'text',
    extra: Partial<StartSessionOptions> = {},
  ): StartSessionOptions => {
    const persona = personaApi.getSnapshot();
    const extraOverrides = extra.overrides ?? {};
    const firstMessage = extraOverrides.agent?.firstMessage
      ?? entryFirstMessage
      ?? undefined;
    const agentOverride = {
      ...extraOverrides.agent,
      ...(firstMessage ? { firstMessage } : {}),
    };
    const conversationOverride = {
      ...(kind === 'text' ? { textOnly: true } : {}),
      ...extraOverrides.conversation,
    };
    const overrides: StartSessionOptions['overrides'] = {
      ...extraOverrides,
      ...(Object.keys(agentOverride).length > 0 ? { agent: agentOverride } : {}),
      ...(Object.keys(conversationOverride).length > 0 ? { conversation: conversationOverride } : {}),
    };

    return {
      connectionType: 'websocket',
      userId: answers.realName || answers.callMe || undefined,
      dynamicVariables: {
        call_me: answers.callMe || persona.callMe || 'friend',
        main_goal: answers.feeling || '',
        source: answers.source || '',
        we_can_phrase: buildWeCanPhrase(answers.feeling || '', answers.source || ''),
        is_returning_user: persona.callMe ? 'true' : 'false',
        recurring_themes: persona.themes,
        recent_meditations: persona.meditations,
      },
      useWakeLock: false,
      preferHeadphonesForIosDevices: true,
      ...(kind === 'text' ? { textOnly: true } : {}),
      ...extra,
      overrides,
    };
  };

  const buildVoiceSessionOptions = (): StartSessionOptions => {
    if (coldVoiceIntroUsedRef.current || !isIosWebKitRuntime()) {
      return buildSessionOptions('voice');
    }

    coldVoiceIntroUsedRef.current = true;
    const baseFirstMessage = entryFirstMessage ?? defaultVoiceFirstMessage(answers);
    const firstMessage = coldStartVoiceFirstMessage(baseFirstMessage);

    console.log('[11labs] cold iOS first message', {
      baseFirstMessage: baseFirstMessage.slice(0, 120),
      firstMessage: firstMessage.slice(0, 160),
    });

    return buildSessionOptions('voice', {
      overrides: {
        agent: { firstMessage },
      },
    });
  };

  const startConversationSession = async (
    kind: 'voice' | 'text',
    options: StartSessionOptions,
  ) => {
    setAgentError(null);
    intendedKindRef.current = kind;
    setConversationKind(kind);

    const fetchStartedAt = performance.now();
    console.log('[11labs] signed-url fetch start', { kind });
    if (kind === 'voice') {
      logAudioRoute('voice.signed-url.fetch-start', voiceElapsed(voiceStartAtRef.current));
    }
    try {
      const signedUrl = await getConversationSignedUrl();
      console.log('[11labs] signed-url fetch done', {
        kind,
        elapsedMs: Math.round(performance.now() - fetchStartedAt),
      });
      if (kind === 'voice') {
        logAudioRoute('voice.signed-url.fetch-done', voiceElapsed(voiceStartAtRef.current), {
          fetchElapsedMs: Math.round(performance.now() - fetchStartedAt),
        });
      }
      console.log('[11labs] startSession', {
        kind,
        connectionType: kind === 'voice' ? 'websocket' : options.connectionType,
        firstMessage:
          typeof options.overrides?.agent?.firstMessage === 'string'
            ? options.overrides.agent.firstMessage.slice(0, 120)
            : '(dashboard default)',
        hasSignedUrl: true,
      });
      if (kind === 'voice') {
        logAudioRoute('voice.start-session.before', voiceElapsed(voiceStartAtRef.current), {
          connectionType: 'websocket',
          hasSignedUrl: true,
        });
      }
      startSession({
        ...options,
        ...(kind === 'voice' ? { connectionType: 'websocket' } : {}),
        signedUrl,
      } as Parameters<typeof startSession>[0]);
    } catch (error) {
      // Text-only fallback through public agentId can make the ElevenLabs React
      // SDK render a text conversation path that throws during render
      // ("setMicMuted is not supported in text conversations"). Let the typed
      // chat caller use the local style-picker fallback instead.
      if (kind === 'text' || !ELEVENLABS_AGENT_ID) throw error;
      console.warn('[11labs] signed URL unavailable, trying public agent ID fallback', error);
      console.log('[11labs] startSession fallback', {
        kind,
        connectionType: options.connectionType,
        firstMessage:
          typeof options.overrides?.agent?.firstMessage === 'string'
            ? options.overrides.agent.firstMessage.slice(0, 120)
            : '(dashboard default)',
        hasAgentId: true,
      });
      if (kind === 'voice') {
        logAudioRoute('voice.start-session.fallback-before', voiceElapsed(voiceStartAtRef.current), {
          connectionType: options.connectionType,
          hasAgentId: true,
        });
      }
      startSession({ ...options, agentId: ELEVENLABS_AGENT_ID } as Parameters<typeof startSession>[0]);
    }
  };

  const showTypedMeditationStyles = () => {
    setAgentError(null);
    pendingTextMessageRef.current = null;
    if (conversationKind === 'text') {
      if (status === 'connected') {
        try {
          endSession();
        } catch {
          /* stale SDK session - ignore */
        }
      }
      setConversationKind(null);
    }
    setShowStyles(true);
    setSuggestedVibe(null);
    if (latestKokoro?.text !== TYPED_MEDITATION_PROMPT) {
      appendMessage('kokoro', TYPED_MEDITATION_PROMPT);
    }
  };

  const sendTypedToAgent = async (text: string) => {
    setAgentError(null);
    setShowStyles(false);
    setSuggestedVibe(null);

    const sendNow = () => {
      try {
        void sendUserMessage(text);
        return true;
      } catch (error) {
        console.error('[11labs] send typed message failed', error);
        return false;
      }
    };

    if (status === 'connected' && conversationKind === 'text' && sendNow()) {
      return;
    }

    if (status === 'connected') {
      try {
        endSession();
      } catch {
        /* stale SDK session - ignore */
      }
    }

    pendingTextMessageRef.current = text;
    try {
      await startConversationSession('text', buildSessionOptions('text'));
    } catch (error) {
      pendingTextMessageRef.current = null;
      setConversationKind(null);
      console.error('[11labs] typed text session failed', error);
      setAgentError(friendlyApiError(error));
      appendMessage('kokoro', typedFollowupFor(text));
    }
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => () => {
    stopVoiceAudioElementNudgeRef.current?.();
    stopAudioStream(voicePrewarmStreamRef.current);
  }, []);

  useEffect(() => {
    if (!selectedVibe || !result || announcedResultRef.current) return;
    if (phase !== 'streaming' && phase !== 'ready') return;
    announcedResultRef.current = true;
    appendMessage('kokoro', 'I made this for you. You can listen now.');
  }, [appendMessage, phase, result, selectedVibe]);

  useEffect(() => {
    if (!isSpeaking || voiceStartAtRef.current === null) return;

    let ticks = 0;
    const interval = window.setInterval(() => {
      ticks += 1;
      let inputVolume: number | null = null;
      let outputVolume: number | null = null;
      try {
        inputVolume = Number(getInputVolume().toFixed(4));
      } catch {
        /* volume unavailable */
      }
      try {
        outputVolume = Number(getOutputVolume().toFixed(4));
      } catch {
        /* volume unavailable */
      }
      console.log('[11labs] audio volume probe', {
        elapsedMs: voiceElapsed(voiceStartAtRef.current),
        inputVolume,
        outputVolume,
      });
      if (firstVolumeProbeAtRef.current === null) {
        firstVolumeProbeAtRef.current = performance.now();
        logAudioRoute('voice.first-volume-probe', voiceElapsed(voiceStartAtRef.current), {
          inputVolume,
          outputVolume,
        });
      }
      if (
        outputVolume !== null &&
        outputVolume > 0 &&
        firstOutputVolumeAtRef.current === null
      ) {
        firstOutputVolumeAtRef.current = performance.now();
        logAudioRoute('voice.first-output-volume', voiceElapsed(voiceStartAtRef.current), {
          inputVolume,
          outputVolume,
        });
      }
      const elapsedMs = voiceElapsed(voiceStartAtRef.current);
      if (
        outputVolume === 0 &&
        elapsedMs !== undefined &&
        elapsedMs >= 2000 &&
        lateZeroOutputRouteAtRef.current === null
      ) {
        lateZeroOutputRouteAtRef.current = performance.now();
        logAudioRoute('voice.output-still-zero-after-2s', elapsedMs, {
          inputVolume,
          outputVolume,
        });
      }
      if (ticks >= 32) window.clearInterval(interval);
    }, 250);

    return () => window.clearInterval(interval);
  }, [getInputVolume, getOutputVolume, isSpeaking]);

  // Push-to-talk: opens a fresh voice session, connected live. The press/release
  // handlers own the mute state; this only handles the cold-start connect.
  const beginVoiceSession = async () => {
    voiceStartAtRef.current = performance.now();
    firstAgentTextAtRef.current = null;
    firstSpeakingAtRef.current = null;
    firstAudioChunkAtRef.current = null;
    firstVolumeProbeAtRef.current = null;
    firstOutputVolumeAtRef.current = null;
    lateZeroOutputRouteAtRef.current = null;
    audioChunkCountRef.current = 0;
    audioChunkBytesRef.current = 0;
    console.log('[11labs] voice press', {
      status,
      conversationKind,
      isMuted,
      hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    });
    logAudioRoute('voice.tap.before-unlock', voiceElapsed(voiceStartAtRef.current), {
      status,
      conversationKind,
      isMuted,
    });
    unlockAudio();
    logAudioRoute('voice.tap.after-unlock', voiceElapsed(voiceStartAtRef.current));
    logAudioElements('voice.tap.after-unlock', voiceElapsed(voiceStartAtRef.current));
    stopVoiceAudioElementNudge();
    stopVoiceAudioElementNudgeRef.current = startConversationAudioElementNudge(
      () => voiceElapsed(voiceStartAtRef.current),
      { durationMs: 6500, intervalMs: 120 },
    );
    console.log('[audio] mic route prewarm skipped');
    logAudioRoute('voice.prewarm.skipped', voiceElapsed(voiceStartAtRef.current), {
      reason: 'testing ElevenLabs-owned microphone setup',
    });

    if (!navigator.mediaDevices?.getUserMedia) {
      setAgentError('Voice is not available in this iOS webview. Type to Kokoro instead.');
      setTypeOpen(true);
      return;
    }

    setAgentError(null);
    setStartingVoice(true);
    try {
      console.log('[11labs] voice session request', {
        elapsedMs: voiceElapsed(voiceStartAtRef.current),
      });
      logAudioRoute('voice.session-request', voiceElapsed(voiceStartAtRef.current));
      await startConversationSession('voice', buildVoiceSessionOptions());
    } catch (error) {
      console.error('[11labs] beginVoiceSession threw', error);
      stopVoiceAudioElementNudge();
      stopVoicePrewarm();
      setStartingVoice(false);
      setConversationKind(null);
      setAgentError(friendlyApiError(error));
      setTypeOpen(true);
    }
  };

  // Finger down on the mic = "I'm talking now". If a voice call is already up
  // we just unmute; otherwise we open one (it connects live).
  const handleMicPressStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture unsupported */
    }
    wantMicLiveRef.current = true;
    haptic.light();
    // A text->voice swap is already in flight (the text session is tearing down).
    // Ignore further presses until voice opens, so a second press can't also fire
    // the cold-start path below and start a second voice session.
    if (startVoiceAfterTeardownRef.current) return;
    if (status === 'connected') {
      if (conversationKind === 'voice') {
        logAudioRoute('voice.press.unmute', voiceElapsed(voiceStartAtRef.current));
        setMuted(false);
      } else {
        // A text-only session is open. Unlock audio inside this tap (iOS needs it
        // in-gesture), tear the text session down, and open voice from onDisconnect
        // above. Starting voice here would let the old session's late onDisconnect
        // null the new voice session's conversationKind. This makes the FIRST mic
        // press after typing open voice (previously it silently took two presses).
        logAudioRoute('voice.press.swap-text-for-voice', voiceElapsed(voiceStartAtRef.current));
        unlockAudio();
        pendingTextMessageRef.current = null;
        // Show the mic as 'connecting' immediately and hold it through the
        // teardown->voice handoff so the button never flashes the idle/green state.
        setStartingVoice(true);
        startVoiceAfterTeardownRef.current = true;
        try {
          endSession();
        } catch {
          /* stale SDK session - ignore */
        }
        setConversationKind(null);
        // Safety net if onDisconnect is delayed or never fires for this teardown.
        window.setTimeout(() => {
          if (startVoiceAfterTeardownRef.current) {
            startVoiceAfterTeardownRef.current = false;
            void beginVoiceSession();
          }
        }, 600);
      }
      return;
    }
    void beginVoiceSession();
  };

  // Finger up = stop talking. Mute the mic but keep the call connected so
  // Kokoro can answer and the next hold is instant.
  const handleMicPressEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer capture unsupported */
    }
    if (!wantMicLiveRef.current) return;
    wantMicLiveRef.current = false;
    // Gate on status only — a stray onDisconnect/onError can null conversationKind
    // and would otherwise strand the mic unmuted (button stuck non-gray).
    if (status === 'connected' && conversationKind === 'voice') {
      logAudioRoute('voice.release.mute', voiceElapsed(voiceStartAtRef.current));
      setMuted(true);
    } else if (status !== 'connected') {
      // Released before the session connected — mute as soon as it does.
      pendingMuteRef.current = true;
    }
  };

  // On connect, honor push-to-talk — if the finger was released before the
  // connection landed (or a mute is pending), mute now so the mic isn't left hot
  // capturing background noise. (startingVoice is cleared by the SDK
  // onConnect/onDisconnect/onError callbacks, so it isn't touched here.)
  useEffect(() => {
    if (status === 'connected' && conversationKind === 'voice') {
      if (!wantMicLiveRef.current || pendingMuteRef.current) {
        pendingMuteRef.current = false;
        setMuted(true);
      }
    } else if (status === 'disconnected') {
      pendingMuteRef.current = false;
    }
  }, [conversationKind, status, setMuted]);

  const submitTyped = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const userTurnsAfterSend = messagesRef.current.filter((message) => message.role === 'user').length + 1;
    // Explicit "make me one" always fast-paths to the cards. Informational /
    // exploratory messages defer to the agent (info + proposal) instead of the
    // turn-count auto-jump, matching how voice already behaves.
    const asksExplicitly = typedMessageAsksForMeditation(text);
    const infoSeeking = typedMessageIsInfoSeeking(text);
    const shouldOfferMeditation =
      asksExplicitly ||
      (!infoSeeking && userTurnsAfterSend >= 2 && text.length >= 18 && !/\?$/.test(text));

    setDraft('');
    if (!shouldOfferMeditation) {
      setShowStyles(false);
      setSuggestedVibe(null);
    }
    appendMessage('user', text);
    window.setTimeout(() => {
      if (shouldOfferMeditation) {
        showTypedMeditationStyles();
      } else {
        void sendTypedToAgent(text);
      }
    }, 180);
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
      try {
        sendContextualUpdate(
          `The user chose ${VIBE_CARDS[vibe].title} style. The app has started generating a personalized meditation in the background.`,
        );
      } catch {
        /* voice session ended while the style was selected */
      }
    }
    kickoffMeditationFor(vibe, nextAnswers, null);
    personaApi.recordMeditation({ vibe, feeling: answers.feeling });
  };

  const openResult = () => {
    if (!selectedVibe) return;
    unlockAudio(); // prime audio inside the tap so the player can autoplay on iOS
    generatedMeditationApi.selectVibeAsCurrent(selectedVibe);
    goto('player');
  };

  // Push-to-talk mic visual state — mutually exclusive, in priority order:
  //  - connecting: opening the session OR transport not yet 'connected' (covers
  //    the iOS cold-start delay, so the button never reads as a dead orange)
  //  - live: connected and mic hot (finger held / unmuted)
  //  - muted: connected but not holding ("push to talk" rest state)
  //  - idle: nothing open yet — the GREEN "ready" state
  const micState: 'idle' | 'connecting' | 'live' | 'muted' =
    status === 'connecting' || (startingVoice && status !== 'connected')
      ? 'connecting'
      : status === 'connected'
        ? (isMuted ? 'muted' : 'live')
        : 'idle';

  return (
    <Frame className={`k3-chat-frame ${isGeneratingMeditation ? 'is-generating' : ''}`}>
      {!aiConsent && (
        <div className="k3-ai-consent" role="dialog" aria-modal="true" aria-label="AI processing notice">
          <div className="k3-ai-consent-card">
            <h2>Before we begin</h2>
            <p>
              Kokoro creates your meditation using AI. Your voice and messages are processed by{' '}
              <strong>ElevenLabs</strong> (voice), an <strong>AI language model</strong> (to write
              your meditation), and <strong>Suno</strong> (to create the audio). It's sent securely
              and isn't used to identify you.
            </p>
            <button
              type="button"
              className="k3-ai-consent-accept"
              onClick={() => {
                try {
                  localStorage.setItem('kokoro_ai_consent', '1');
                } catch {
                  /* storage unavailable */
                }
                haptic.light();
                setAiConsent(true);
              }}
            >
              Continue
            </button>
            <button type="button" className="k3-ai-consent-decline" onClick={() => goto(chatReturnRoute)}>
              Not now
            </button>
            <button
              type="button"
              className="k3-ai-consent-link"
              onClick={() => window.open(PRIVACY_URL, '_blank')}
            >
              Privacy Policy
            </button>
          </div>
        </div>
      )}
      <header className="k3-chat-top">
        <BackButton
          onClick={() => {
            if (status === 'connected') endSession();
            goto(chatReturnRoute);
          }}
        />
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

      <div className="k3-bubble-stack">
        <div className="k3-bubble-slot k3-bubble-slot-kokoro">
          {showStyles && !isGeneratingMeditation ? (
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
      </div>

      {isGeneratingMeditation && (
        <div
          className={`${isPadNative ? 'k3-pad-making-bar' : 'k3-making-bar'}${typeOpen ? ' is-typing-mode' : ''}`}
        >
          {makingCard}
        </div>
      )}

      <section className={`k3-chat-log ${showStyles ? 'has-panel' : ''} ${typeOpen ? 'is-typing-mode' : ''} ${result ? 'has-result' : ''}`} aria-live="polite">
        {result && (phase === 'streaming' || phase === 'ready') && (
          <button className="k3-result-card" onClick={openResult}>
            <div>
              <span>Your meditation</span>
              <strong>{vibeCard(result.vibe).title} - {formatDuration(result.durationSec)}</strong>
            </div>
            <Play size={22} fill="currentColor" />
          </button>
        )}
      </section>

      {selectedVibe && phase === 'error' && !dismissedErrorVibes.has(selectedVibe) && (
        <div className="k3-error-toast" role="alert">
          <div className="k3-error-toast-text">
            <strong>
              {generationError || `Couldn't make ${vibeCard(selectedVibe).title}`}
            </strong>
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
          {agentError}
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
                className={`k3-mic k3-mic--${micState}`}
                onPointerDown={handleMicPressStart}
                onPointerUp={handleMicPressEnd}
                onPointerCancel={handleMicPressEnd}
                onLostPointerCapture={handleMicPressEnd}
                onContextMenu={(event) => event.preventDefault()}
                aria-busy={micState === 'connecting'}
                title={micState === 'idle' ? 'Tap to start' : 'Hold to speak'}
                aria-label={micState === 'idle' ? 'Tap to start' : 'Hold to speak'}
              >
                {micState === 'connecting' ? (
                  <Loader2 size={30} className="k3-mic-spin" />
                ) : micState === 'muted' ? (
                  <MicOff size={30} />
                ) : (
                  <Mic size={32} />
                )}
              </button>
              {status === 'connected' && <span className="k3-end-btn k3-end-btn--ghost" aria-hidden="true" />}
            </div>
            <div className="k3-voice-status">
              {micState === 'connecting'
                ? 'Connecting…'
                : micState === 'live'
                  ? 'Listening… release to stop'
                  : micState === 'muted'
                    ? 'Hold to speak'
                    : 'Tap to start'}
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

function formatRelativeDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function extractCaptureField(capture: string | undefined, label: string): string {
  if (!capture) return '';
  const labels = CAPTURE_FIELD_LABELS
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)${escaped}:\\s*([\\s\\S]*?)(?=\\n(?:${labels}):|$)`);
  const match = capture.match(re);
  return match ? match[1].trim() : '';
}

function trimPreview(value: string, max = 58): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max - 1).trimEnd();
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 28 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}...`;
}

function cleanCapturePreview(capture: string | undefined): string {
  const raw = cleanText(capture);
  if (!raw) return '';

  const told = cleanText(extractCaptureField(raw, 'What they told Kokoro'));
  let text = told || raw;

  if (!told && CAPTURE_FIELD_LABELS.some((label) => raw.includes(`${label}:`))) {
    const feeling = cleanText(extractCaptureField(raw, 'How they are carrying today'));
    const source = cleanText(extractCaptureField(raw, 'Where it seems to be coming from'));
    text = feeling || source ? buildWeCanPhrase(feeling, source) : '';
  }

  text = text
    .replace(/^\s*(?:\.\.\.|[.?!,-])+\s*/, '')
    .replace(/\bjust make it\b\.?/gi, '')
    .replace(/\bright now\b\.?/gi, '')
    .replace(/\bnow\b\.?/gi, '')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  text = text
    .replace(/^please\s+/i, '')
    .replace(/^make\s+(?:me\s+)?(?:a\s+)?(?:meditation|ritual|song)\s+(?:about|for)\s+/i, 'About ')
    .replace(/^i\s+(?:want|need)\s+(?:a\s+)?(?:meditation|ritual|song)\s+(?:about|for)\s+/i, 'About ')
    .trim();

  if (!text) return '';
  return trimPreview(text.charAt(0).toUpperCase() + text.slice(1));
}

function libraryItemTitle(item: LibraryItem): string {
  return `${vibeCard(item.vibe).title} meditation`;
}

function libraryItemSubtitle(item: LibraryItem): string {
  const cleanPreview = cleanCapturePreview(item.capturePreview);
  if (cleanPreview) return cleanPreview;

  const feeling = extractCaptureField(item.capturePreview, 'How they are carrying today');
  const source = extractCaptureField(item.capturePreview, 'Where it seems to be coming from');
  if (feeling || source) {
    const phrase = buildWeCanPhrase(feeling, source);
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  }
  return SHORT_VIBE_COPY[item.vibe];
}

function libraryItemArtwork(item: Pick<LibraryItem, 'vibe'>): { thumb: string; poster: string } {
  return {
    thumb: vibeCard(item.vibe).thumb,
    poster: vibeCard(item.vibe).poster,
  };
}

function openLibraryItem(item: LibraryItem, goto: (r: Route) => void) {
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
    const onEnded = () => goto('promise');
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    void audio.play().catch(() => {});
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src, goto]);

  // While the player screen is open: keep the screen awake (no auto-lock) and
  // hold a background-capable audio session so playback survives a manual lock.
  // Reverted on leave so it never touches the ElevenLabs voice flow.
  useEffect(() => {
    void enterPlaybackMode();
    return () => {
      void exitPlaybackMode();
    };
  }, []);

  if (!generated || !src) {
    return (
      <Frame className="k3-player-empty">
        <BackButton onClick={() => goto('home')} />
        <BlendedVideo file="kokoro-meditate.mp4" poster="kokoro-meditate.png" className="k3-empty-mascot" />
        <h2>No meditation yet.</h2>
        <PrimaryButton
          variant="sunset"
          onClick={() => {
            setChatEntry({
              firstMessage: "It's good to see you again friend! Want to talk about something that's on your mind?",
              returnRoute: 'home',
            });
            goto('chat');
          }}
        >
          Talk to Kokoro
        </PrimaryButton>
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
      </header>

      <section className="k3-player-art">
        <BlendedVideo file="kokoro-meditate.mp4" poster="kokoro-meditate.png" className="k3-player-mascot" />
      </section>

      <section className="k3-player-copy">
        <span>Your meditation</span>
        <h1>{vibeCard(generated.vibe).title}</h1>
        <span className="k3-player-eyebrow-below">{vibeCard(generated.vibe).eyebrow}</span>
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

      <SaveMeditationButton meditationId={generated.meditationId} canSave={!!src} />

      <button className="k3-play-button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={32} fill="currentColor" /> : <Play size={34} fill="currentColor" />}
      </button>

      <div className="k3-player-done">
        <PrimaryButton onClick={() => goto('home')}>Home</PrimaryButton>
        <a
          className="k3-report-link"
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
            'Report a Kokoro meditation',
          )}&body=${encodeURIComponent(`Meditation ID: ${generated.meditationId}\n\nWhat's wrong with this meditation:\n`)}`}
        >
          Report this meditation
        </a>
      </div>
    </Frame>
  );
}

function SaveMeditationButton({ meditationId, canSave }: { meditationId: string; canSave: boolean }) {
  const { items, save, error, refresh } = useLibrary();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isLibraryAvailable()) void refresh();
  }, [refresh]);

  if (!isLibraryAvailable()) {
    return <div className="k3-save-note">Open in Telegram to save to library.</div>;
  }

  const saved = items.some((item) => item.meditationId === meditationId);
  const disabled = pending || !canSave || saved;

  const label = !canSave
    ? 'Preparing audio...'
    : pending
      ? 'Saving...'
      : saved
        ? 'Saved to library'
        : 'Save to library';

  const onClick = async () => {
    if (disabled) return;
    setPending(true);
    try {
      await save(meditationId);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="k3-save-wrap">
      <button className={`k3-save-button ${saved ? 'is-saved' : ''}`} disabled={disabled} onClick={onClick}>
        {saved ? <Check size={18} strokeWidth={2.7} /> : <BookOpen size={18} strokeWidth={2.4} />}
        <span>{label}</span>
      </button>
      {saved && <small>It will show in Library and first on Home.</small>}
      {error && <span className="k3-save-error">{error}</span>}
    </div>
  );
}

/* Greeting name that gently crossfades between the user's first names
   (pet name + real-name's first word). Stays on a single line because
   we only ever rotate single-word names. */
function RotatingName({ names, intervalMs = 4000 }: { names: string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (names.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % names.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [names.length, intervalMs]);

  if (names.length === 0) {
    return (
      <strong>
        friend<span className="k3-name-rotator-dot">.</span>
      </strong>
    );
  }
  if (names.length === 1) {
    return (
      <strong>
        {names[0]}<span className="k3-name-rotator-dot">.</span>
      </strong>
    );
  }

  const longest = names.reduce((a, b) => (a.length >= b.length ? a : b));
  const current = names[index % names.length];

  return (
    <span className="k3-name-rotator">
      <span className="k3-name-rotator-spacer" aria-hidden="true">{longest}.</span>
      <strong key={`name-${index}`} className="k3-name-rotator-in">
        {current}<span className="k3-name-rotator-dot">.</span>
      </strong>
    </span>
  );
}

export function Home3({ goto }: ScreenProps) {
  const { answers } = useAnswers();
  const { generated } = useGeneratedMeditation();
  const byVibe = useGeneratedMeditationsByVibe();
  const { items: savedItems, refresh: refreshLibrary } = useLibrary();
  const greetingNames = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    const add = (raw: string | undefined) => {
      const first = (raw || '').trim().split(/\s+/)[0];
      if (!first) return;
      const key = first.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push(first);
    };
    add(answers.callMe);
    add(answers.realName);
    return list.length > 0 ? list : ['friend'];
  }, [answers.callMe, answers.realName]);

  useEffect(() => {
    if (isLibraryAvailable()) void refreshLibrary();
  }, [refreshLibrary]);

  const recentVibes = useMemo(() => {
    const generatedList = ALL_VIBES.filter((v) => byVibe[v]);
    if (generatedList.length > 0) return generatedList;
    return ['raw', 'zen', 'sleep'] as Vibe[];
  }, [byVibe]);

  const savedPreviewItems = useMemo(() => savedItems.slice(0, 2), [savedItems]);
  const weekVibes = useMemo(() => {
    const used = new Set(savedPreviewItems.map((item) => item.vibe));
    const ordered = [...recentVibes, 'raw', 'zen', 'sleep', 'cosmic', 'iron'] as Vibe[];
    return ordered
      .filter((vibe, index) => ordered.indexOf(vibe) === index && !used.has(vibe))
      .slice(0, Math.max(1, 4 - savedPreviewItems.length));
  }, [recentVibes, savedPreviewItems]);

  const playVibe = (vibe: Vibe) => {
    if (byVibe[vibe]) {
      unlockAudio();
      generatedMeditationApi.selectVibeAsCurrent(vibe);
      goto('player');
    } else {
      setChatEntry({
        firstMessage: `Do you want to make something in ${VIBE_CARDS[vibe].title} style today? Tell me what's on your mind.`,
        returnRoute: 'home',
      });
      goto('chat');
    }
  };

  return (
    <Frame className="k3-home-frame">
      <div className="k3-home-scroll">
        <section className="k3-home-head">
          <div className="k3-home-meta">
            <span className="k3-home-meta-kanji" lang="ja">朝</span>
            <span className="k3-home-meta-label">Morning</span>
          </div>
          <h1>Hey <RotatingName names={greetingNames} /></h1>
          <p>How's your heart today?</p>
        </section>

        <button className="k3-home-hero" onClick={() => openReturningChat(goto, answers, 'home')}>
          <div className="k3-home-hero-text">
            <span>Voice ritual</span>
            <strong>Talk to Kokoro</strong>
            <p>Tell me one true thing and I'll make you something.</p>
          </div>
          <div className="k3-home-hero-art">
            <InlineLoopVideo file="kokoro-meditate.mp4" poster="kokoro-meditate.png" />
          </div>
        </button>

        {generated && (
          <button className="k3-continue-card" onClick={() => { unlockAudio(); goto('player'); }}>
            <span>Continue</span>
            <strong>{vibeCard(generated.vibe).title} meditation is ready</strong>
            <Send size={16} />
          </button>
        )}

        <div className="k3-home-tiles">
          <button onClick={() => goto('quickReset')}>
            <Wind size={18} />
            <strong>60-second reset</strong>
            <span>no story, just breath</span>
          </button>
          <button onClick={() => goto('sleep')}>
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
            {savedPreviewItems.map((item) => {
              const artwork = libraryItemArtwork(item);
              return (
              <button
                key={`saved-${item.meditationId}`}
                className="k3-recent-card k3-recent-card-saved"
                style={{ '--pill': vibeCard(item.vibe).accent } as CSSProperties}
                onClick={() => openLibraryItem(item, goto)}
              >
                <div className="k3-recent-thumb">
                  <InlineLoopVideo file={artwork.thumb} poster={artwork.poster} />
                </div>
                <div className="k3-recent-meta">
                  <span className="k3-recent-pill">Saved</span>
                  <span className="k3-recent-date">{formatRelativeDate(item.generatedAt || item.savedAt)}</span>
                </div>
                <strong className="k3-recent-title">{libraryItemTitle(item)}</strong>
                <span className="k3-recent-sub">{libraryItemSubtitle(item)}</span>
                <div className="k3-recent-foot">
                  <span className="k3-recent-duration">{formatDuration(item.durationSec)}</span>
                </div>
              </button>
              );
            })}
            {weekVibes.map((vibe) => (
              <button
                key={vibe}
                className="k3-recent-card"
                style={{ '--pill': VIBE_CARDS[vibe].accent } as CSSProperties}
                onClick={() => playVibe(vibe)}
              >
                <div className="k3-recent-thumb">
                  <InlineLoopVideo file={VIBE_CARDS[vibe].thumb} poster={VIBE_CARDS[vibe].poster} />
                </div>
                <div className="k3-recent-meta">
                  <span className="k3-recent-pill">{VIBE_CARDS[vibe].title}</span>
                  <span className="k3-recent-date">{byVibe[vibe] ? 'Ready' : 'New'}</span>
                </div>
                <strong className="k3-recent-title">
                  {byVibe[vibe] ? `${VIBE_CARDS[vibe].title} meditation` : VIBE_CARDS[vibe].title}
                </strong>
                <span className="k3-recent-sub">{SHORT_VIBE_COPY[vibe]}</span>
                <div className="k3-recent-foot">
                  <span className="k3-recent-duration">
                    {byVibe[vibe] ? formatDuration(byVibe[vibe]?.durationSec) : 'Create'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <TabBar active="home" goto={goto} />
    </Frame>
  );
}

function PresetRitual3({
  goto,
  title,
  eyebrow,
  copy,
  icon,
  vibe,
  feeling,
  source,
  carry,
}: ScreenProps & {
  title: string;
  eyebrow: string;
  copy: string;
  icon: ReactNode;
  vibe: Vibe;
  feeling: string;
  source: string;
  carry: string;
}) {
  const { setAnswer } = useAnswers();

  const start = () => {
    haptic.medium();
    setAnswer('feeling', feeling);
    setAnswer('source', source);
    setAnswer('chips', [feeling, source]);
    setAnswer('carry', carry);
    setAnswer('vibe', vibe);
    personaApi.addTheme(feeling);
    personaApi.addTheme(source);
    setChatEntry({
      firstMessage: vibe === 'sleep'
        ? "Let's wind down. Tell me what your body is still carrying from today."
        : "Let's do the 60-second reset. Take one breath with me, then tell me what your body needs right now.",
      returnRoute: vibe === 'sleep' ? 'sleep' : 'quickReset',
    });
    goto('chat');
  };

  return (
    <Frame className="k3-preset-frame">
      <header className="k3-companion-head">
        <BackButton onClick={() => goto('home')} />
        <span>{eyebrow}</span>
      </header>

      <section className="k3-preset-card">
        <div className="k3-preset-icon">{icon}</div>
        <h1>{title}</h1>
        <p>{copy}</p>
        <PrimaryButton variant="sunset" onClick={start}>Start with Kokoro</PrimaryButton>
      </section>

      <BlendedVideo file="kokoro-meditate.mp4" poster="kokoro-meditate.png" className="k3-preset-mascot" />
      <TabBar active="talk" goto={goto} />
    </Frame>
  );
}

export function QuickReset3({ goto }: ScreenProps) {
  return (
    <PresetRitual3
      goto={goto}
      title="60-second reset"
      eyebrow="breath ritual"
      copy="A short check-in for when you do not want the whole story. Kokoro will keep it simple and body-led."
      icon={<Wind size={24} />}
      vibe="zen"
      feeling="Calm me down"
      source="My body"
      carry="I need a 60-second reset. No story, just breath. Help me settle my body right now."
    />
  );
}

export function Sleep3({ goto }: ScreenProps) {
  return (
    <PresetRitual3
      goto={goto}
      title="Wind down"
      eyebrow="sleep ritual"
      copy="A slower evening path for letting the day leave your body before bed."
      icon={<Moon size={24} />}
      vibe="sleep"
      feeling="Help me sleep"
      source="My body"
      carry="I want to wind down for sleep. Help me release the day from my body and get quiet."
    />
  );
}

export function Progress3({ goto }: ScreenProps) {
  const byVibe = useGeneratedMeditationsByVibe();
  const progress = useMeditationProgress();
  const { items, refresh } = useLibrary();
  const readyVibes = ALL_VIBES.filter((vibe) => byVibe[vibe]);
  const activeCount = ALL_VIBES.filter((vibe) => progress[vibe].phase !== 'idle').length;
  const completedCount = Math.max(items.length, readyVibes.length);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Frame className="k3-progress-frame">
      <header className="k3-companion-head">
        <BackButton onClick={() => goto('home')} />
        <h1>Progress</h1>
      </header>

      <section className="k3-progress-hero">
        <span>This week</span>
        <strong>{completedCount}</strong>
        <p>{completedCount === 1 ? 'ritual ready or saved' : 'rituals ready or saved'}</p>
      </section>

      <div className="k3-stat-grid">
        <div>
          <span>Started</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Saved</span>
          <strong>{items.length}</strong>
        </div>
      </div>

      <section className="k3-progress-list" aria-label="Meditations by type">
        {ALL_VIBES.map((vibe) => {
          const count = items.filter((it) => it.vibe === vibe).length;
          return (
            <div key={vibe} className="k3-progress-row">
              <span style={{ '--pill': VIBE_CARDS[vibe].accent } as CSSProperties} />
              <div>
                <strong>{VIBE_CARDS[vibe].title}</strong>
              </div>
              <span className="k3-progress-count">{count}</span>
            </div>
          );
        })}
      </section>

      <TabBar active="progress" goto={goto} />
    </Frame>
  );
}

export function You3({ goto }: ScreenProps) {
  const { answers, reset } = useAnswers();
  const { persona } = usePersona();
  const { refresh } = useLibrary();
  const webAuth = useWebAuth();
  const pwa = usePwa();
  const webClient = isProtectedWebClient();
  const displayName = answers.callMe || persona.callMe || answers.realName || persona.realName || 'friend';
  const realName = answers.realName || persona.realName || '';
  const themes = persona.themes || [answers.feeling, answers.source].filter(Boolean).join(', ');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startOver = () => {
    haptic.medium();
    reset();
    personaApi.reset();
    generatedMeditationApi.resetAll();
    meditationProgressApi.reset();
    goto('welcome');
  };

  // Native Apple identity remains local-only. Web/PWA deletion also removes the
  // Supabase identity, but deliberately never mutates or cancels Stripe billing.
  const clearLocalAccount = () => {
    reset();
    personaApi.reset();
    generatedMeditationApi.resetAll();
    meditationProgressApi.reset();
    try {
      localStorage.removeItem('kokoro_local_library');
      localStorage.removeItem('kokoro_ai_consent');
      sessionStorage.clear();
    } catch {
      /* storage unavailable */
    }
  };

  const deleteAccount = async () => {
    const message = webClient
      ? 'Delete your Kokoro account and app data?\n\nDeleting your Kokoro account does not cancel your Stripe subscription. Manage or cancel it first. This cannot be undone.'
      : 'Delete your account and all your data?\n\nThis permanently removes your name, saved meditations, and Apple sign-in from this device. This cannot be undone.';
    const ok = window.confirm(message);
    if (!ok) return;
    haptic.medium();
    if (webClient) {
      try {
        await webAuthApi.deleteAccount();
      } catch {
        window.alert('Kokoro could not delete the account right now. Please try again.');
        return;
      }
    } else {
      authApi.signOut(); // removes the saved Apple credential (kokoro_auth)
    }
    clearLocalAccount();
    goto(webClient ? 'login' : 'welcome');
  };

  const signOutWeb = async () => {
    await webAuthApi.signOut();
    goto('login');
  };

  return (
    <Frame className="k3-you-frame">
      <header className="k3-companion-head">
        <BackButton onClick={() => goto('home')} />
        <h1>You</h1>
      </header>

      <div className="k3-you-scroll">
      <section className="k3-you-card">
        <div className="k3-you-avatar">
          <UserRound size={30} />
        </div>
        <span>Kokoro calls you</span>
        <h2>{displayName}</h2>
        {realName && <p>{realName}</p>}
        {webClient && webAuth.session?.email && <p>{webAuth.session.email}</p>}
      </section>

      <section className="k3-memory-list">
        <div>
          <span>Recurring themes</span>
          <strong>{themes || 'Not enough yet'}</strong>
        </div>
        <div>
          <span>Last check-in</span>
          <strong>{answers.feeling || 'None yet'}</strong>
        </div>
      </section>

      <div className="k3-you-actions">
        <button onClick={() => goto('name')}>Edit name</button>
        <button onClick={() => openReturningChat(goto, answers, 'you')}>Talk now</button>
        {webClient && (
          <button onClick={() => window.open(
            webAuth.access?.manageUrl ?? 'https://kokoromind.com/manage',
            '_blank',
          )}>Manage subscription</button>
        )}
        {webClient && pwa.canInstall && (
          <button onClick={() => void pwaApi.install()}>Install Kokoro</button>
        )}
        {webClient && <button className="is-muted" onClick={() => void signOutWeb()}>Sign out</button>}
        <button className="is-muted" onClick={startOver}>Start over</button>
        <button className="is-destructive" onClick={() => void deleteAccount()}>Delete account</button>
      </div>

      <div className="k3-you-legal">
        <button type="button" onClick={() => window.open(PRIVACY_URL, '_blank')}>Privacy Policy</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => window.open(TERMS_URL, '_blank')}>Terms</button>
        <p>For relaxation &amp; mindfulness. Not a medical device.</p>
      </div>
      </div>

      <TabBar active="you" goto={goto} />
    </Frame>
  );
}

export function Library3({ goto }: ScreenProps) {
  const { items, loading, loaded, error, refresh } = useLibrary();

  useEffect(() => {
    if (isLibraryAvailable()) void refresh();
  }, [refresh]);

  return (
    <Frame className="k3-library-frame">
      <header className="k3-library-head">
        <BackButton onClick={() => goto('home')} />
        <h1>Library</h1>
      </header>

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
          {items.map((item) => {
            return (
              <button
                key={item.meditationId}
                className="k3-library-card"
                style={{ '--pill': vibeCard(item.vibe).accent } as CSSProperties}
                onClick={() => openLibraryItem(item, goto)}
              >
                <div className="k3-library-info">
                  <div className="k3-library-meta">
                    <span>{vibeCard(item.vibe).title}</span>
                    <small>{formatRelativeDate(item.generatedAt || item.savedAt)}</small>
                  </div>
                  <strong>{libraryItemTitle(item)}</strong>
                  <p>{libraryItemSubtitle(item)}</p>
                  <small>{formatDuration(item.durationSec)}</small>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <TabBar active="library" goto={goto} />
    </Frame>
  );
}

function TabBar({ active, goto }: { active: 'home' | 'library' | 'talk' | 'progress' | 'you'; goto: (r: Route) => void }) {
  const { answers } = useAnswers();
  const tabs = useMemo(
    () => [
      { id: 'home', label: 'Home', icon: Home, route: 'home' as Route },
      { id: 'library', label: 'Library', icon: Library, route: 'library' as Route },
      { id: 'talk', label: 'Talk', icon: Mic, route: 'chat' as Route },
      { id: 'progress', label: 'Progress', icon: BarChart3, route: 'progress' as Route },
      { id: 'you', label: 'You', icon: UserRound, route: 'you' as Route },
    ],
    [],
  );
  const talkReturnRoute: Route =
    active === 'library' ? 'library' :
    active === 'progress' ? 'progress' :
    active === 'you' ? 'you' :
    'home';

  return (
    <nav className="k3-tabbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            className={`${active === tab.id ? 'is-active' : ''} ${tab.id === 'talk' ? 'is-primary' : ''}`}
            onClick={() => {
              if (tab.id === 'talk') {
                openReturningChat(goto, answers, talkReturnRoute);
              } else {
                goto(tab.route);
              }
            }}
          >
            <Icon size={25} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
