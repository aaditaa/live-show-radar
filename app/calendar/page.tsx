import Link from 'next/link';
import { ArtistAvatar } from '@/components/artist-avatar';
import { PageHeader } from '@/components/page-header';
import { HOME_CITY } from '@/lib/cities';
import { getUpcomingShows, type ShowWithArtist } from '@/lib/queries';
import { IST, formatEventDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DOT: Record<string, string> = {
  P0: 'bg-[var(--p0-from)]',
  P1: 'bg-[var(--p1-from)]',
  P2: 'bg-[var(--p2-from)]',
  P3: 'bg-[var(--p3-from)]',
};

/** Today in IST as YYYY-MM-DD, so "today" matches what the user's clock says. */
function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function shiftMonth(year: number, month: number, by: number) {
  const date = new Date(Date.UTC(year, month - 1 + by, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const params = await searchParams;
  const today = istToday();
  const [todayYear, todayMonth] = today.split('-').map(Number);

  const requested = /^\d{4}-\d{2}$/.test(params.m ?? '') ? params.m! : null;
  const year = requested ? Number(requested.slice(0, 4)) : todayYear;
  const month = requested ? Number(requested.slice(5, 7)) : todayMonth;

  const rows = await getUpcomingShows();

  // A month-precision show has no real day, so it is listed beside the grid
  // rather than pinned to the 1st, which would be a date we invented.
  const byDay = new Map<string, ShowWithArtist[]>();
  const undated: ShowWithArtist[] = [];
  for (const row of rows) {
    if (!row.show.eventDate || row.show.datePrecision === 'month') {
      undated.push(row);
      continue;
    }
    const list = byDay.get(row.show.eventDate);
    if (list) list.push(row);
    else byDay.set(row.show.eventDate, [row]);
  }

  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay is Sunday-first; shift so the grid starts on Monday.
  const leading = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `${year}-${String(month).padStart(2, '0')}-${day}`;
    }),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const inMonth = rows.filter(
    (row) => row.show.eventDate?.startsWith(`${year}-${String(month).padStart(2, '0')}`) && row.show.datePrecision === 'day',
  );

  const navLink =
    'rounded-lg border border-[var(--line)] bg-[var(--panel-raised)] px-3 py-1.5 text-sm transition hover:border-white/25';

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={`Every upcoming show on one grid. ${rows.length} shows tracked · ${inMonth.length} in ${monthLabel(year, month)}.`}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link href={`/calendar?m=${prev.year}-${String(prev.month).padStart(2, '0')}`} className={navLink}>
          ← {monthLabel(prev.year, prev.month).split(' ')[0]}
        </Link>
        <h2 className="text-[15px] font-semibold">{monthLabel(year, month)}</h2>
        <Link href={`/calendar?m=${next.year}-${String(next.month).padStart(2, '0')}`} className={navLink}>
          {monthLabel(next.year, next.month).split(' ')[0]} →
        </Link>
        {requested ? (
          <Link href="/calendar" className="text-sm text-[var(--muted)] hover:text-white">
            Today
          </Link>
        ) : null}
        <span className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted-dim)]">
          {(['P0', 'P1', 'P2', 'P3'] as const).map((p) => (
            <span key={p} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DOT[p]}`} aria-hidden />
              {p}
            </span>
          ))}
        </span>
      </div>

      <div className="panel mt-4 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--line)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted-dim)]">
          {DOW.map((d) => (
            <div key={d} className="px-3 py-2.5 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, index) => {
            const dayShows = date ? (byDay.get(date) ?? []) : [];
            const isToday = date === today;
            const isPast = date !== null && date < today;

            return (
              <div
                key={date ?? `pad-${index}`}
                className={`min-h-[104px] border-b border-r border-[var(--line)] p-2 last:border-r-0 ${
                  date === null ? 'bg-black/20' : isPast ? 'opacity-45' : ''
                }`}
              >
                {date ? (
                  <>
                    <span
                      className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs ${
                        isToday
                          ? 'bg-[var(--accent)] font-semibold text-white'
                          : 'text-[var(--muted)]'
                      }`}
                    >
                      {Number(date.slice(8))}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayShows.map((row) => (
                        <div
                          key={row.show.id}
                          title={`${row.artistName} — ${row.show.city}${row.show.venue ? `, ${row.show.venue}` : ''}`}
                          className="flex items-center gap-1.5 rounded-md bg-white/[0.05] px-1.5 py-1"
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[row.show.priority]}`}
                            aria-hidden
                          />
                          <span className="truncate text-[11px] leading-tight">
                            {row.artistName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">Dated shows</h2>
        {inMonth.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-[var(--line)] px-5 py-6 text-sm text-[var(--muted)]">
            Nothing dated in {monthLabel(year, month)}.
          </p>
        ) : (
          <ul className="panel mt-3 divide-y divide-[var(--line)]">
            {inMonth.map((row) => (
              <li key={row.show.id} className="flex items-center gap-3 px-4 py-3">
                <ArtistAvatar name={row.artistName} imageUrl={row.artistImageUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.artistName}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {row.show.city}
                    {row.show.venue ? ` · ${row.show.venue}` : ''}
                    {row.show.city === HOME_CITY ? ' · home city' : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {formatEventDate(row.show.eventDate, 'day')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {undated.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold">Date not announced</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            These shows are real but no exact date has been published, so they are not placed on
            the grid rather than guessed at.
          </p>
          <ul className="panel mt-3 divide-y divide-[var(--line)]">
            {undated.map((row) => (
              <li key={row.show.id} className="flex items-center gap-3 px-4 py-3">
                <ArtistAvatar name={row.artistName} imageUrl={row.artistImageUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.artistName}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {row.show.city}
                    {row.show.venue ? ` · ${row.show.venue}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {formatEventDate(row.show.eventDate, row.show.datePrecision as 'day' | 'month')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
