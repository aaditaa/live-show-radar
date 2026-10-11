/** Small inline icon set, so the sidebar needs no icon dependency. */
type IconProps = { className?: string };

const base = 'h-[18px] w-[18px] shrink-0';

export function IconDashboard({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  );
}

export function IconArtists({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.1 2.5-5.3 5.5-5.3s5.5 2.2 5.5 5.3" strokeLinecap="round" />
      <path d="M16.5 5.2a3.2 3.2 0 0 1 0 6M18 14.9c2 .7 3.5 2.6 3.5 5.1" strokeLinecap="round" />
    </svg>
  );
}

export function IconBell({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" strokeLinejoin="round" />
      <path d="M10.3 19a2 2 0 0 0 3.4 0" strokeLinecap="round" />
    </svg>
  );
}

export function IconPulse({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <path d="M3 12h3.5l2-6 3.5 12 2.5-7 1.8 3h4.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBook({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" strokeLinejoin="round" />
      <path d="M8 8h8M8 12h5" strokeLinecap="round" />
    </svg>
  );
}

export function IconTicket({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <path d="M3 9.5V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a2.5 2.5 0 0 0 0-5Z" strokeLinejoin="round" />
      <path d="M14 6v12" strokeDasharray="2 2.5" />
    </svg>
  );
}

export function IconPin({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function IconClock({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" strokeLinecap="round" />
    </svg>
  );
}

export function IconLogout({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" strokeLinecap="round" />
      <path d="M10 8l-4 4 4 4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconStar({ filled = false, className = '' }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      className={`${base} ${className}`}
    >
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.7l5.9-.8Z" strokeLinejoin="round" />
    </svg>
  );
}
