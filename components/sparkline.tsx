/**
 * Items found per scan, most recent last.
 *
 * One series, so no legend — the tile's heading names it. No axes or grid: at
 * this size they would outweigh the data. Only the latest point is labelled,
 * and the full numbers live on /scans, which is this chart's table view.
 */
export function Sparkline({
  values,
  width = 150,
  height = 34,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label?: string;
}) {
  if (values.length < 2) {
    return <div className="h-[34px]" aria-hidden />;
  }

  const max = Math.max(...values, 1);
  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const step = w / (values.length - 1);

  const points = values.map((v, i) => [pad + i * step, pad + h - (v / max) * h] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${pad + h} L${points[0][0].toFixed(1)},${pad + h} Z`;
  const [lx, ly] = points[points.length - 1];

  // Rough path length, so the draw-on animation has something to run against.
  const len = Math.round(
    points.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1])), 0),
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        label ??
        `Items found over the last ${values.length} scans, most recent ${values[values.length - 1]}`
      }
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--p1-from)" stopOpacity="0.38" />
          <stop offset="100%" stopColor="var(--p1-from)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path
        d={line}
        fill="none"
        stroke="var(--p1-from)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spark-line"
        style={{ ['--len' as string]: len }}
      />
      {/* The latest point, ringed in the surface colour so it stays readable on the line. */}
      <circle cx={lx} cy={ly} r="3.6" fill="var(--accent)" stroke="var(--panel)" strokeWidth="2" />
    </svg>
  );
}
