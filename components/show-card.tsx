import type { ShowWithArtist } from '@/lib/queries';
import { IconClock, IconPin, IconStar, IconTicket } from '@/components/icons';
import { formatCountdown, formatEventDate, formatRelative } from '@/lib/time';

/** Each priority gets its own gradient, so urgency reads before any text does. */
const GRADIENT: Record<string, string> = {
  P0: 'from-[var(--p0-from)] to-[var(--p0-to)]',
  P1: 'from-[var(--p1-from)] to-[var(--p1-to)]',
  P2: 'from-[var(--p2-from)] to-[var(--p2-to)]',
  P3: 'from-[var(--p3-from)] to-[var(--p3-to)]',
};

const PRIORITY_NOTE: Record<string, string> = {
  P0: 'Buy today',
  P1: 'Act soon',
  P2: 'On the radar',
  P3: 'Unconfirmed',
};

function earlyBird(show: ShowWithArtist['show']) {
  const endsIn = formatCountdown(show.earlyBirdDeadline);
  switch (show.earlyBirdStatus) {
    case 'open':
      return endsIn && endsIn !== 'ended' ? `Early bird ends in ${endsIn}` : 'Early bird open';
    case 'imminent':
      return 'Early bird opens soon';
    case 'sold_out':
      return 'Early bird sold out';
    case 'closed':
      return 'Early bird closed';
    default:
      return 'Early bird not mentioned';
  }
}

export function ShowCard({ row }: { row: ShowWithArtist }) {
  const { show, artistName, artistStarred } = row;
  const gradient = GRADIENT[show.priority] ?? GRADIENT.P3;
  const live = show.earlyBirdStatus === 'open' || show.earlyBirdStatus === 'imminent';

  return (
    <article
      className={`relative flex min-h-[224px] w-[290px] shrink-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg shadow-black/30`}
    >
      {/* Soft facet, echoing the embossed shapes on the reference cards. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-8 h-40 w-40 rounded-full bg-black/15 blur-xl"
      />

      <header className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-base font-semibold leading-tight">
            {artistStarred ? <IconStar filled className="h-3.5 w-3.5 text-white/90" /> : null}
            <span className="truncate">{artistName}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-white/70">
            {show.isFestival && show.festivalName
              ? show.festivalName
              : (show.eventName ?? 'Live show')}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold tracking-wide">
          {show.priority}
        </span>
      </header>

      <div className="relative mt-5 space-y-1.5 text-sm">
        <p className="flex items-center gap-2 text-white/90">
          <IconClock className="h-4 w-4 text-white/60" />
          {formatEventDate(show.eventDate, show.datePrecision as 'day' | 'month')}
        </p>
        <p className="flex items-center gap-2 text-white/90">
          <IconPin className="h-4 w-4 text-white/60" />
          <span className="truncate">
            {show.city}
            {show.venue ? ` · ${show.venue}` : ' · venue TBA'}
          </span>
        </p>
      </div>

      <div className="relative mt-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            live ? 'bg-white text-black' : 'bg-black/25 text-white/80'
          }`}
        >
          <IconTicket className="h-3.5 w-3.5" />
          {earlyBird(show)}
        </span>
        {show.earlyBirdNote ? (
          <p className="mt-1.5 text-[11px] text-white/60">{show.earlyBirdNote}</p>
        ) : null}
      </div>

      <footer className="relative mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
        <div className="flex items-center gap-2">
          {show.ticketUrl ? (
            <a
              href={show.ticketUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-black transition hover:bg-white"
            >
              Tickets{show.ticketPlatform ? ` · ${show.ticketPlatform}` : ''}
            </a>
          ) : (
            <span className="rounded-lg bg-black/20 px-2.5 py-1.5 text-xs text-white/60">
              Ticket link TBA
            </span>
          )}
          {show.sourceUrls[0] ? (
            <a
              href={show.sourceUrls[0]}
              target="_blank"
              rel="noreferrer noopener"
              className="text-white/70 underline decoration-white/30 underline-offset-2 hover:text-white"
            >
              Source
            </a>
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] text-white/55" title={`First seen ${formatRelative(show.firstSeenAt)}`}>
          {PRIORITY_NOTE[show.priority]}
        </span>
      </footer>
    </article>
  );
}
