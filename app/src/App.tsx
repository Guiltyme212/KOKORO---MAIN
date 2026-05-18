import { useEffect, type ComponentType } from 'react';
import { ConversationProvider } from '@elevenlabs/react';
import { useRouter, type Route } from './lib/router';
import { initTelegram } from './lib/telegram';
import {
  Chat3,
  Feeling3,
  Home3,
  Library3,
  Name3,
  Player3,
  Promise3,
  Source3,
  Welcome3,
} from './screens/Kokoro3';
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
  quickReset: Chat3,
  sleep: Chat3,
};

export default function App() {
  const { route, transitioning, goto } = useRouter();

  useEffect(() => {
    initTelegram();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    function trackKeyboard() {
      const tg = window.Telegram?.WebApp;
      let kbH = 0;
      if (tg && tg.initData) {
        const stable = tg.viewportStableHeight || tg.viewportHeight || 0;
        const current = tg.viewportHeight || 0;
        kbH = Math.max(0, stable - current);
      } else if (window.visualViewport) {
        kbH = Math.max(0, window.innerHeight - window.visualViewport.height);
      }
      kbH = Math.min(500, kbH);
      const inputFocused =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';
      root.style.setProperty('--k3-kb-h', `${Math.round(kbH)}px`);
      root.classList.toggle('k3-kb-open', inputFocused && kbH > 200);
    }
    trackKeyboard();
    window.visualViewport?.addEventListener('resize', trackKeyboard);
    window.addEventListener('focusin', trackKeyboard);
    window.addEventListener('focusout', trackKeyboard);
    const tg = window.Telegram?.WebApp;
    tg?.onEvent?.('viewportChanged', trackKeyboard);
    return () => {
      window.visualViewport?.removeEventListener('resize', trackKeyboard);
      window.removeEventListener('focusin', trackKeyboard);
      window.removeEventListener('focusout', trackKeyboard);
      tg?.offEvent?.('viewportChanged', trackKeyboard);
    };
  }, []);

  const Active = SCREENS[route];

  const content = (
    <div className="stage">
      <div className={`page-wrap ${transitioning ? 'exiting' : 'entered'}`} key={route}>
        <Active goto={goto} />
      </div>
    </div>
  );

  if (route === 'chat' || route === 'contentType' || route === 'composing' || route === 'pickwhatlands') {
    return <ConversationProvider>{content}</ConversationProvider>;
  }

  return content;
}
