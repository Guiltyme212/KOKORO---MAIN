import type { Route } from '../lib/router';
import './Jumper.css';

const NUMBERED: { id: Route; num: string }[] = [
  { id: 'welcome',     num: '01' },
  { id: 'name',        num: '02' },
  { id: 'capture',     num: '03' },
  { id: 'mirror',      num: '04' },
  { id: 'contentType', num: '05' },
  { id: 'composing',   num: '06' },
  { id: 'player',      num: '07' },
  { id: 'reflect',     num: '08' },
];

export function Jumper({ route, goto }: { route: Route; goto: (r: Route) => void }) {
  return (
    <div className="jumper">
      {NUMBERED.map((s) => (
        <button
          key={s.id}
          className={route === s.id ? 'active' : ''}
          onClick={() => goto(s.id)}
          title={s.id}
        >
          {s.num}
        </button>
      ))}
    </div>
  );
}
