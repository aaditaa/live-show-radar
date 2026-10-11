'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconArtists,
  IconBell,
  IconBook,
  IconCalendar,
  IconDashboard,
  IconLock,
  IconPulse,
} from '@/components/icons';

const LINKS = [
  { href: '/', label: 'Dashboard', Icon: IconDashboard },
  { href: '/calendar', label: 'Calendar', Icon: IconCalendar },
  { href: '/artists', label: 'Artists', Icon: IconArtists },
  { href: '/alerts', label: 'Alerts', Icon: IconBell },
  { href: '/scans', label: 'Scans', Icon: IconPulse },
  { href: '/how-it-works', label: 'How it works', Icon: IconBook },
];

export function Sidebar({ homeCity, artistCount }: { homeCity: string; artistCount: number }) {
  const pathname = usePathname();

  return (
    <aside className="flex shrink-0 flex-col gap-6 border-b border-[var(--line)] bg-[var(--bg-deep)] px-4 py-5 lg:h-screen lg:w-60 lg:border-r lg:border-b-0 lg:sticky lg:top-0">
      <Link href="/" className="flex items-center gap-2.5 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--p1-from)] to-[var(--p1-to)] text-sm">
          ◎
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Live Show Radar</span>
      </Link>

      {/* The watch summary, standing in for the balance card in a finance app. */}
      <div className="hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3 lg:block">
        <p className="text-[11px] uppercase tracking-wide text-[var(--muted-dim)]">Watching</p>
        <p className="mt-0.5 text-xl font-semibold">{artistCount} artists</p>
        <p className="text-[11px] text-[var(--muted)]">home city {homeCity}</p>
      </div>

      <nav className="rail flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {LINKS.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? 'bg-[var(--panel-raised)] font-medium text-white shadow-[inset_0_0_0_1px_var(--line)]'
                  : 'text-[var(--muted)] hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Icon className={active ? 'text-[var(--accent)]' : ''} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden lg:block">
        <Link
          href="/admin"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
            pathname.startsWith('/admin')
              ? 'bg-[var(--panel-raised)] font-medium text-white shadow-[inset_0_0_0_1px_var(--line)]'
              : 'text-[var(--muted)] hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          <IconLock className={pathname.startsWith('/admin') ? 'text-[var(--accent)]' : ''} />
          Admin
        </Link>
        <p className="mt-3 px-1 text-[11px] leading-relaxed text-[var(--muted-dim)]">
          Times in Asia/Kolkata. Every show here was found live by the scanner — nothing is
          seeded.
        </p>
      </div>
    </aside>
  );
}
