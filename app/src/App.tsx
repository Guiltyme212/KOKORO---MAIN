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
    function fit() {
      if (window.innerWidth > 500) {
        root.style.removeProperty('--k3-frame-scale');
        return;
      }
      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      const scale = Math.min(w / 390, h / 844);
      root.style.setProperty('--k3-frame-scale', String(scale));
    }
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      window.visualViewport?.removeEventListener('resize', fit);
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
