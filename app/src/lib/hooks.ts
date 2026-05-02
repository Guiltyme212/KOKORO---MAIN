import { useEffect, useState } from 'react';

/**
 * Time in seconds since mount, advancing every animation frame.
 * Used by breathing, drift, and other ambient animations.
 */
export function useAnimationTime() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (ts: number) => {
      setT((ts - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}
