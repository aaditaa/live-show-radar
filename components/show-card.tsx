import type { ShowWithArtist } from '@/lib/queries';
import { ArtistAvatar } from '@/components/artist-avatar';
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
  const { show, artistName, artistStarred, artistImageUrl } = row;
  const gradient = GRADIENT[show.priority] ?? GRADIENT.P3;
  const live = show.earlyBirdStatus === 'open' || show.earlyBirdStatus === 'imminent';

  return (
    <article
      className={`relative flex min-h-[320px] w-[368px] max-w-[88vw] shrink-0 flex-col overflow-hidden rounded-[20px] bg-gradient-to-br ${gradient} p-6 text-white shadow-xl shadow-black/35`}
    >
      {/* Soft facets, echoing the embossed shapes on the reference cards. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-black/20 blur-2xl"
      />

      <header className="relative flex items-start gap-3.5">
        <ArtistAvatar
          name={artistName}
          imageUrl={artistImageUrl}
          size="lg"
          className="ring-2 ring-white/25"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            {artistStarred ? <IconStar filled className="h-4 w-4 shrink-0 text-white/90" /> : null}
            <span className="truncate">{artistName}</span>
          </p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-white/70">
            {show.isFestival && show.festivalName
              ? show.festivalName
              : (show.eventName ?? 'Live show')}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-semibold tracking-wide">
          {show.priority}
        </span>
      </header>

      <div className="relative mt-6 space-y-2.5 text-[15px]">
        <p className="flex items-center gap-2.5 text-white/95">
          <IconClock className="h-[18px] w-[18px] shrink-0 text-white/60" />
          {formatEventDate(show.eventDate, show.datePrecision as 'day' | 'month')}
        </p>
        <p className="flex items-start gap-2.5 text-white/95">
          <IconPin className="mt-0.5 h-[18px] w-[18px] shrink-0 text-white/60" />
          <span className="min-w-0">
            <span className="font-medium">{show.city}</span>
            <span className="block text-[13px] text-white/65">{show.venue ?? 'Venue TBA'}</span>
          </span>
        </p>
      </div>

      <div className="relative mt-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            live ? 'bg-white text-black' : 'bg-black/25 text-white/80'
          }`}
        >
          <IconTicket className="h-4 w-4" />
          {earlyBird(show)}
        </span>
        {show.earlyBirdNote ? (
          <p className="mt-2 text-xs text-white/65">{show.earlyBirdNote}</p>
        ) : null}
      </div>

      <footer className="relative mt-auto flex items-end justify-between gap-3 pt-5">
        <div className="flex items-center gap-3">
          {show.ticketUrl ? (
            <a
              href={show.ticketUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-xl bg-white/95 px-3.5 py-2 text-[13px] font-semibold text-black transition hover:bg-white"
            >
              Tickets{show.ticketPlatform ? ` · ${show.ticketPlatform}` : ''}
            </a>
          ) : (
            <span className="rounded-xl bg-black/20 px-3.5 py-2 text-[13px] text-white/60">
              Ticket link TBA
            </span>
          )}
          {show.sourceUrls[0] ? (
            <a
              href={show.sourceUrls[0]}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[13px] text-white/70 underline decoration-white/30 underline-offset-2 hover:text-white"
            >
              Source
            </a>
          ) : null}
        </div>
        <span className="shrink-0 text-right text-[11px] leading-tight text-white/55">
          {PRIORITY_NOTE[show.priority]}
          <span className="block text-white/40">seen {formatRelative(show.firstSeenAt)}</span>
        </span>
      </footer>
    </article>
  );
}
