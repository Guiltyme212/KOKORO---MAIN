type AudioElementSnapshot = {
  index: number;
  isPrime: boolean;
  paused: boolean;
  ended: boolean;
  readyState: number;
  networkState: number;
  currentTime: number;
  muted: boolean;
  volume: number;
  autoplay: boolean;
  hasSrcObject: boolean;
  display: string;
  sinkId?: string;
};

type NudgeOptions = {
  durationMs?: number;
  intervalMs?: number;
};

const PRIME_SELECTOR = 'audio[data-kokoro-audio-prime="true"]';

function getAudioElements(): HTMLAudioElement[] {
  return Array.from(document.querySelectorAll('audio'));
}

function snapshotAudioElement(element: HTMLAudioElement, index: number): AudioElementSnapshot {
  const sinkId = (element as HTMLAudioElement & { sinkId?: string }).sinkId;
  return {
    index,
    isPrime: element.matches(PRIME_SELECTOR),
    paused: element.paused,
    ended: element.ended,
    readyState: element.readyState,
    networkState: element.networkState,
    currentTime: Number(element.currentTime.toFixed(3)),
    muted: element.muted,
    volume: Number(element.volume.toFixed(3)),
    autoplay: element.autoplay,
    hasSrcObject: Boolean(element.srcObject),
    display: element.style.display,
    ...(typeof sinkId === 'string' ? { sinkId } : {}),
  };
}

function snapshotAudioElements(): AudioElementSnapshot[] {
  return getAudioElements().map(snapshotAudioElement);
}

function conversationAudioElements(): HTMLAudioElement[] {
  return getAudioElements().filter((element) => !element.matches(PRIME_SELECTOR));
}

function prepareConversationAudioElement(element: HTMLAudioElement): void {
  element.autoplay = true;
  element.muted = false;
  element.setAttribute('playsinline', 'true');
  element.setAttribute('webkit-playsinline', 'true');
  if (element.volume === 0) element.volume = 1;
}

function playConversationAudioElements(
  label: string,
  elapsedMs: number | undefined,
  logResult: boolean,
): void {
  conversationAudioElements().forEach((element, index) => {
    prepareConversationAudioElement(element);

    void element.play()
      .then(() => {
        if (!logResult) return;
        console.log('[audio] conversation media play ok', {
          label,
          elapsedMs,
          index,
          snapshot: snapshotAudioElement(element, index),
        });
      })
      .catch((error) => {
        if (!logResult) return;
        console.warn('[audio] conversation media play failed', {
          label,
          elapsedMs,
          index,
          snapshot: snapshotAudioElement(element, index),
          error,
        });
      });
  });
}

export function logAudioElements(label: string, elapsedMs?: number): void {
  console.log('[audio] media elements', {
    label,
    elapsedMs,
    elements: snapshotAudioElements(),
  });
}

export function nudgeConversationAudioElements(label: string, elapsedMs?: number): void {
  const elements = conversationAudioElements();

  console.log('[audio] conversation media nudge', {
    label,
    elapsedMs,
    conversationElementCount: elements.length,
    allElements: snapshotAudioElements(),
  });

  playConversationAudioElements(label, elapsedMs, true);
}

export function startConversationAudioElementNudge(
  getElapsedMs: () => number | undefined,
  options: NudgeOptions = {},
): () => void {
  const durationMs = options.durationMs ?? 5500;
  const intervalMs = options.intervalMs ?? 120;
  const startedAt = performance.now();
  let stopped = false;
  let lastSignature = '';

  const run = (label: string) => {
    if (stopped) return;

    const snapshots = snapshotAudioElements();
    const signature = JSON.stringify(snapshots.map((snapshot) => ({
      isPrime: snapshot.isPrime,
      paused: snapshot.paused,
      readyState: snapshot.readyState,
      networkState: snapshot.networkState,
      hasSrcObject: snapshot.hasSrcObject,
    })));

    if (signature !== lastSignature) {
      lastSignature = signature;
      logAudioElements(label, getElapsedMs());
      playConversationAudioElements(label, getElapsedMs(), true);
      return;
    }

    playConversationAudioElements(label, getElapsedMs(), false);
  };

  run('voice.audio-nudge.start');

  const intervalId = window.setInterval(() => {
    const elapsed = performance.now() - startedAt;
    if (elapsed >= durationMs) {
      window.clearInterval(intervalId);
      stopped = true;
      logAudioElements('voice.audio-nudge.done', getElapsedMs());
      return;
    }
    run('voice.audio-nudge.tick');
  }, intervalMs);

  return () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(intervalId);
    logAudioElements('voice.audio-nudge.stop', getElapsedMs());
  };
}
