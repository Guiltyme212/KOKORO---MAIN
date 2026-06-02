let primedContext: AudioContext | null = null;
let primedElement: HTMLAudioElement | null = null;
let primedDestination: MediaStreamAudioDestinationNode | null = null;
let releaseTimer: number | null = null;

function elapsed(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

// Keep this synchronous in the tap handler so WebKit still sees user intent.
// WKWebView is picky: unlock both Web Audio and a MediaStream-backed audio
// element, which matches the output path used by the ElevenLabs WebSocket SDK.
export function unlockAudio(): void {
  const audioWindow = window as Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    if (!primedContext || primedContext.state === 'closed') {
      primedContext = new AudioContextCtor();
      primedDestination = primedContext.createMediaStreamDestination();
    }
    const context = primedContext;

    if (!primedElement && primedDestination) {
      primedElement = new Audio();
      primedElement.autoplay = true;
      primedElement.muted = false;
      primedElement.volume = 1;
      primedElement.dataset.kokoroAudioPrime = 'true';
      primedElement.setAttribute('playsinline', 'true');
      primedElement.style.display = 'none';
      primedElement.srcObject = primedDestination.stream;
      document.body.appendChild(primedElement);
    }

    console.log('[audio] unlock route prime', {
      contextState: context.state,
      hasPrimedElement: Boolean(primedElement),
      hasPrimedDestination: Boolean(primedDestination),
      primedElementPaused: primedElement?.paused,
    });

    void context.resume().catch(() => {});

    const gain = context.createGain();
    gain.gain.value = 0.000001;
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 440;
    oscillator.connect(gain);
    gain.connect(context.destination);
    if (primedDestination) gain.connect(primedDestination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.04);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });

    if (primedElement) {
      void primedElement.play()
        .then(() => {
          console.log('[audio] primed media element play ok', {
            paused: primedElement?.paused,
            readyState: primedElement?.readyState,
          });
        })
        .catch((error) => {
          console.warn('[audio] primed media element play failed', error);
        });
    }

    if (releaseTimer !== null) window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => {
      primedElement?.pause();
      primedElement?.remove();
      primedElement = null;
      primedDestination = null;
      void primedContext?.close().catch(() => {});
      primedContext = null;
      releaseTimer = null;
    }, 12000);
  } catch (error) {
    console.warn('[audio] unlock failed', error);
  }
}

export async function prewarmMicrophoneRoute(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;

  const startedAt = performance.now();
  console.log('[audio] mic route prewarm start');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: { ideal: 1 },
      },
    });
    const [track] = stream.getAudioTracks();
    console.log('[audio] mic route prewarm done', {
      elapsedMs: elapsed(startedAt),
      trackState: track?.readyState,
      settings: track?.getSettings?.(),
    });
    return stream;
  } catch (error) {
    console.warn('[audio] mic route prewarm failed', {
      elapsedMs: elapsed(startedAt),
      error,
    });
    return null;
  }
}

export function stopAudioStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}
