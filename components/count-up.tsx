'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts a figure up on first paint. Starts from the final value so a reader
 * with reduced motion, or with JS disabled, sees the real number immediately.
 */
export function CountUp({ value, duration = 650 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      value <= 1
    ) {
      return;
    }

    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // Ease out, so it settles rather than stopping dead.
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    // No synchronous reset: the first frame computes t=0, which renders 0 anyway.
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{shown}</span>;
}
