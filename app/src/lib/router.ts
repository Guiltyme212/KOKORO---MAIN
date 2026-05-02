import { useCallback, useEffect, useState } from 'react';

export type Route =
  | 'welcome'
  | 'name'
  | 'capture'
  | 'mirror'
  | 'transition'
  | 'contentType'
  | 'composing'
  | 'player'
  | 'reflect'
  | 'home'
  | 'library'
  | 'quickReset'
  | 'sleep';

const VALID: Route[] = [
  'welcome', 'name', 'capture', 'mirror', 'transition',
  'contentType', 'composing', 'player', 'reflect',
  'home', 'library', 'quickReset', 'sleep',
];

const isRoute = (s: string): s is Route => (VALID as string[]).includes(s);

const fromHash = (): Route => {
  const h = (window.location.hash || '#welcome').slice(1);
  return isRoute(h) ? h : 'welcome';
};

export function useRouter() {
  const [route, setRoute] = useState<Route>(fromHash);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goto = useCallback((next: Route) => {
    if (!isRoute(next)) return;
    setTransitioning(true);
    window.setTimeout(() => {
      window.location.hash = next;
      setTransitioning(false);
    }, 320);
  }, []);

  return { route, transitioning, goto };
}
