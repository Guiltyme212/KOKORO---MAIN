import { useEffect, type ComponentType } from 'react';
import { ConversationProvider } from '@elevenlabs/react';
import { useRouter, type Route } from './lib/router';
import { initTelegram } from './lib/telegram';
import { initNative } from './lib/native';
import { isProtectedWebClient } from './lib/platform';
import { hasCompletedLocalProfile } from './lib/profile';
import { answersApi } from './state/answers';
import { personaApi } from './state/persona';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { useWebAuth, webAuthApi } from './state/webAuth';
import {
  Chat3,
  Feeling3,
  Home3,
  Library3,
  Name3,
  Player3,
  Promise3,
  Progress3,
  QuickReset3,
  Source3,
  Sleep3,
  You3,
  Welcome3,
} from './screens/Kokoro3';
import {
  AccessRequiredScreen,
  CheckingAccessScreen,
  InstallAppScreen,
  LoginScreen,
  VerifyEmailScreen,
} from './screens/WebAuth';
import { pwaApi, shouldOfferInstall, usePwa } from './state/pwa';
import './App.css';
import './styles/kokoro3.css';

type ScreenProps = { goto: (r: Route) => void };

const SCREENS: Record<Route, ComponentType<ScreenProps>> = {
  welcome: Welcome3,
  name: Name3,
  feeling: Feeling3,
  source: Source3,
  promise: Promise3,
  chat: Chat3,
  capture: Feeling3,
  mirror: Source3,
  contentType: Chat3,
  composing: Chat3,
  player: Player3,
  reflect: Home3,
  pickwhatlands: Chat3,
  home: Home3,
  library: Library3,
  quickReset: QuickReset3,
  sleep: Sleep3,
  progress: Progress3,
  you: You3,
  login: LoginScreen,
  verifyEmail: VerifyEmailScreen,
  checkingAccess: CheckingAccessScreen,
  accessRequired: AccessRequiredScreen,
  installApp: InstallAppScreen,
};

export default function App() {
  const { route, transitioning, goto } = useRouter();
  const webAuth = useWebAuth();
  const pwa = usePwa();

  useEffect(() => {
    initTelegram();
    initNative();
    void webAuthApi.initialize();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const tg = window.Telegram?.WebApp;
    const isTGMA = !!(tg && tg.initData);
    if (isTGMA) root.classList.add('tg-mini-app');
    function trackKeyboard() {
      let kbH = 0;
      if (!isTGMA && window.visualViewport) {
        kbH = Math.max(0, window.innerHeight - window.visualViewport.height);
      }
      kbH = Math.min(500, kbH);
      const inputFocused =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';
      root.style.setProperty('--k3-kb-h', `${Math.round(kbH)}px`);
      root.classList.toggle(
        'k3-kb-open',
        inputFocused && (kbH > 200 || isTGMA || root.classList.contains('native-ios')),
      );
    }
    trackKeyboard();
    window.visualViewport?.addEventListener('resize', trackKeyboard);
    window.addEventListener('focusin', trackKeyboard);
    window.addEventListener('focusout', trackKeyboard);
    tg?.onEvent?.('viewportChanged', trackKeyboard);
    return () => {
      window.visualViewport?.removeEventListener('resize', trackKeyboard);
      window.removeEventListener('focusin', trackKeyboard);
      window.removeEventListener('focusout', trackKeyboard);
      tg?.offEvent?.('viewportChanged', trackKeyboard);
    };
  }, []);

  let activeRoute = route;
  if (isProtectedWebClient()) {
    if (webAuth.status === 'initializing' || webAuth.status === 'checkingAccess') {
      activeRoute = 'checkingAccess';
    } else if (webAuth.status === 'signedOut') {
      activeRoute = 'login';
    } else if (webAuth.status === 'verifying') {
      activeRoute = 'verifyEmail';
    } else if (webAuth.status === 'denied' || webAuth.status === 'accessError') {
      activeRoute = 'accessRequired';
    } else if (webAuth.status === 'allowed' && (
      route === 'login' || route === 'verifyEmail' ||
      route === 'checkingAccess' || route === 'accessRequired' ||
      route === 'installApp'
    )) {
      activeRoute = shouldOfferInstall()
        ? 'installApp'
        : hasCompletedLocalProfile(
          answersApi.getSnapshot(),
          personaApi.getSnapshot(),
        ) ? 'home' : 'welcome';
    }
  }
  const Active = SCREENS[activeRoute];

  // On gate screens a reload loses nothing, so apply service-worker updates
  // silently instead of interrupting login with the update banner.
  // verifyEmail is deliberately excluded: reloading there discards the code
  // being typed (and, on the manual path, the pending email). In-app screens
  // keep the banner so we never reload mid-meditation or mid-voice-session.
  const autoUpdateSafe =
    activeRoute === 'login' ||
    activeRoute === 'checkingAccess' ||
    activeRoute === 'accessRequired' ||
    activeRoute === 'installApp';
  useEffect(() => {
    if (pwa.updateReady && autoUpdateSafe) void pwaApi.update();
  }, [pwa.updateReady, autoUpdateSafe]);

  const content = (
    <div className="stage">
      <div className={`page-wrap ${transitioning ? 'exiting' : 'entered'}`} key={activeRoute}>
        <Active goto={goto} />
      </div>
    </div>
  );

  // Mount ConversationProvider UNCONDITIONALLY (not gated on `route`). It is
  // inert without an active session (creates only refs/context — no mic/WebRTC).
  // Gating it on route let Chat3 render in a commit where the provider subtree
  // was torn down/null (e.g. a typed-send racing an agent end_call/onDisconnect),
  // and every useConversation sub-hook throws "must be used within a
  // ConversationProvider" SYNCHRONOUSLY during render → the whole app unmounted
  // to a blank cream screen (App Store Guideline 2.1(a) rejection, Jun 2026).
  // Always-mounting removes that entire class of context-null render crashes.
  return (
    <ConversationProvider>
      {content}
      {!autoUpdateSafe && <PwaUpdatePrompt />}
    </ConversationProvider>
  );
}
