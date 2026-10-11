/**
 * Artist image when we have one, otherwise a deterministic monogram.
 *
 * Images come from Spotify, which is currently unavailable to this app, so the
 * fallback is the common case and has to look deliberate rather than broken.
 * Hue is derived from the name, so an artist keeps the same colour everywhere.
 */
const SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
} as const;

function initials(name: string): string {
  const words = name
    .replace(/^the\s+/i, '')
    .split(/[\s.]+/)
    .filter((word) => /[a-z0-9]/i.test(word));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

export function ArtistAvatar({
  name,
  imageUrl,
  size = 'md',
  className = '',
}: {
  name: string;
  imageUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const shared = `${SIZES[size]} shrink-0 rounded-full object-cover ${className}`;

  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- remote Spotify CDN host, no loader configured
    return <img src={imageUrl} alt="" aria-hidden className={`${shared} bg-white/10`} />;
  }

  const h = hue(name);
  return (
    <span
      aria-hidden
      className={`${shared} grid place-items-center font-semibold text-white/95`}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${h} 62% 52%), hsl(${(h + 48) % 360} 58% 36%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}
