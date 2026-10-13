'use client';

import { useEffect, useState } from 'react';

// Renders the whole phrase, so an expired deadline cannot read
// "ends in closed" when the window lapses while the page is open.
function format(ms: number): string {
  if (ms <= 0) return 'window closed';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `ends in ${d}d ${h}h`;
  if (h > 0) return `ends in ${h}h ${m}m`;
  return `ends in ${m}m ${String(sec).padStart(2, '0')}s`;
}

/**
 * A live countdown to an early-bird deadline.
 *
 * The server renders `initial` so the markup matches on hydration; the ticking
 * only starts once mounted. Under an hour it counts seconds, because that is
 * when the number is actually worth watching.
 */
export function Countdown({ deadline, initial }: { deadline: string; initial: string }) {
  const [label, setLabel] = useState(initial);

  useEffect(() => {
    const target = new Date(deadline).getTime();
    if (Number.isNaN(target)) return;

    const tick = () => setLabel(format(target - Date.now()));
    tick();

    const remaining = target - Date.now();
    // Only burn a per-second timer when the seconds are meaningful.
    const interval = remaining < 3_600_000 ? 1_000 : 60_000;
    const timer = setInterval(tick, interval);
    return () => clearInterval(timer);
  }, [deadline]);

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {label}
    </span>
  );
}
