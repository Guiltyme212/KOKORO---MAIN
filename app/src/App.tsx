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
      const vv = window.visualViewport;
      if (!vv) return;
      const kbH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--k3-kb-h', `${Math.round(kbH)}px`);
    }
    trackKeyboard();
    window.visualViewport?.addEventListener('resize', trackKeyboard);
    window.visualViewport?.addEventListener('scroll', trackKeyboard);
    return () => {
      window.visualViewport?.removeEventListener('resize', trackKeyboard);
      window.visualViewport?.removeEventListener('scroll', trackKeyboard);
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
