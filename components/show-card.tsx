import type { ShowWithArtist } from '@/lib/queries';
import { formatCountdown, formatEventDate, formatRelative } from '@/lib/time';

const PRIORITY_STYLE: Record<string, string> = {
  P0: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  P1: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  P2: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  P3: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
};

function earlyBirdBadge(show: ShowWithArtist['show']) {
  const endsIn = formatCountdown(show.earlyBirdDeadline);
  switch (show.earlyBirdStatus) {
    case 'open':
      return {
        label: endsIn && endsIn !== 'ended' ? `Early bird ends in ${endsIn}` : 'Early bird open',
        className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
      };
    case 'imminent':
      return {
        label: 'Early bird opens soon',
        className: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
      };
    case 'sold_out':
      return {
        label: 'Early bird sold out',
        className: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
      };
    case 'closed':
      return {
        label: 'Early bird closed',
        className: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
      };
    default:
      return {
        label: 'Early bird not mentioned',
        className: 'bg-zinc-500/10 text-zinc-500 ring-zinc-500/20',
      };
  }
}

export function ShowCard({ row }: { row: ShowWithArtist }) {
  const { show, artistName, artistStarred } = row;
  const badge = earlyBirdBadge(show);

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">
            {artistStarred ? <span title="Starred artist">★ </span> : null}
            {artistName}
          </h3>
          <p className="mt-0.5 truncate text-sm text-zinc-400">
            {show.isFestival && show.festivalName
              ? show.festivalName
              : (show.eventName ?? 'Live show')}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            PRIORITY_STYLE[show.priority] ?? PRIORITY_STYLE.P3
          }`}
        >
          {show.priority}
        </span>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Date</dt>
          <dd className="text-zinc-200">
            {formatEventDate(show.eventDate, show.datePrecision as 'day' | 'month')}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">City</dt>
          <dd className="text-zinc-200">{show.city || 'TBA'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Venue</dt>
          <dd className="truncate text-zinc-200">{show.venue ?? 'TBA'}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}
        >
          {badge.label}
        </span>
        {show.earlyBirdNote ? (
          <span className="text-xs text-zinc-500">{show.earlyBirdNote}</span>
        ) : null}
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {show.ticketUrl ? (
          <a
            href={show.ticketUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-200"
          >
            Tickets{show.ticketPlatform ? ` · ${show.ticketPlatform}` : ''}
          </a>
        ) : (
          <span className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-500">
            Ticket link TBA
          </span>
        )}
        {show.sourceUrls[0] ? (
          <a
            href={show.sourceUrls[0]}
            target="_blank"
            rel="noreferrer noopener"
            className="text-zinc-400 underline decoration-dotted hover:text-white"
          >
            Source
          </a>
        ) : null}
        <span className="ml-auto text-xs text-zinc-500">
          first seen {formatRelative(show.firstSeenAt)}
        </span>
      </footer>
    </article>
  );
}
