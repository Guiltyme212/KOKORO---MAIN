import { useEffect, type ComponentType } from 'react';
import { DeviceFrame } from './components/DeviceFrame';
import { StatusBar } from './components/StatusBar';
import { Jumper } from './components/Jumper';
import { useRouter, type Route } from './lib/router';
import { initTelegram } from './lib/telegram';
import { Welcome } from './screens/Welcome';
import { Name } from './screens/Name';
import { Capture } from './screens/Capture';
import { Mirror } from './screens/Mirror';
import { Transition } from './screens/Transition';
import { ContentType } from './screens/ContentType';
import { Composing } from './screens/Composing';
import { Player } from './screens/Player';
import { Reflect } from './screens/Reflect';
import './App.css';

type ScreenProps = { goto: (r: Route) => void };

const SCREENS: Record<Route, ComponentType<ScreenProps>> = {
  welcome: Welcome,
  name: Name,
  capture: Capture,
  mirror: Mirror,
  transition: Transition,
  contentType: ContentType,
  composing: Composing,
  player: Player,
  reflect: Reflect,
  home: Welcome,
  library: Welcome,
  quickReset: Welcome,
  sleep: Welcome,
};

export default function App() {
  const { route, transitioning, goto } = useRouter();

  useEffect(() => {
    initTelegram();
  }, []);

  const Active = SCREENS[route];

  return (
    <div className="stage">
      <Jumper route={route} goto={goto} />
      <DeviceFrame>
        <StatusBar />
        <div className={`page-wrap ${transitioning ? 'exiting' : 'entered'}`} key={route}>
          <Active goto={goto} />
        </div>
      </DeviceFrame>
    </div>
  );
}
