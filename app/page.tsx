import Link from 'next/link';
import { ShowCard } from '@/components/show-card';
import { CountUp } from '@/components/count-up';
import { Sparkline } from '@/components/sparkline';
import { PageHeader } from '@/components/page-header';
import { HOME_CITY } from '@/lib/cities';
import {
  getArtistStats,
  getDistinctCities,
  getLastScan,
  getNextCheckAt,
  getRecentScanActivity,
  getUpcomingShows,
  splitByCity,
  type ShowWithArtist,
} from '@/lib/queries';
import { formatEta, formatIstDateTime, formatRelative } from '@/lib/time';

export const dynamic = 'force-dynamic';

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

/** The top metric strip: label above a large figure, divided by hairlines. */
function Metric({
  label,
  value,
  hint,
  count,
  index = 0,
  children,
}: {
  label: string;
  value?: string;
  hint: string;
  count?: number;
  index?: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{ ['--i' as string]: index }}
      className="rise min-w-[150px] flex-1 px-5 py-4 sm:first:pl-0"
    >
      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted-dim)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">
        {count !== undefined ? <CountUp value={count} /> : value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{hint}</p>
      {children}
    </div>
  );
}

function Rail({
  title,
  note,
  rows,
  empty,
  accent,
}: {
  title: string;
  note: string;
  rows: ShowWithArtist[];
  empty: string;
  accent?: boolean;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          {accent ? (
            <span className="h-4 w-1 rounded-full bg-[var(--accent)]" aria-hidden />
          ) : null}
          {title}
        </h2>
        <span className="text-[11px] text-[var(--muted-dim)]">{note}</span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
          {empty}
        </p>
      ) : (
        <div className="rail mt-3 flex gap-4 overflow-x-auto pb-2">
          {rows.map((row, i) => (
            <ShowCard key={row.show.id} row={row} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; priority?: string }>;
}) {
  const params = await searchParams;
  const city = params.city && params.city !== 'all' ? params.city : undefined;
  const priority = params.priority && params.priority !== 'all' ? params.priority : undefined;

  const [rows, lastScan, nextCheckAt, stats, cities, activity] = await Promise.all([
    getUpcomingShows({ city, priority }),
    getLastScan(),
    getNextCheckAt(),
    getArtistStats(),
    getDistinctCities(),
    getRecentScanActivity(),
  ]);

  const { home, elsewhere } = splitByCity(rows);
  const urgent = rows.filter((row) => row.show.priority === 'P0').length;

  const select =
    'rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]';

  return (
    <>
      <PageHeader
        title="Live shows on the radar"
        subtitle="Concert and festival announcements in India for every artist Karan follows, with early-bird ticket windows called out first."
      />

      <div className="panel flex flex-wrap divide-[var(--line)] px-5 sm:divide-x">
        <Metric
          index={0}
          label="Last scan"
          value={lastScan ? formatRelative(lastScan.startedAt) : 'none yet'}
          hint={lastScan ? formatIstDateTime(lastScan.startedAt) : 'run one from Scans'}
        />
        <Metric
          index={1}
          label="Next due"
          value={formatEta(nextCheckAt)}
          hint={nextCheckAt ? formatIstDateTime(nextCheckAt) : 'no active artists'}
        />
        <Metric
          index={2}
          label="Artists"
          count={stats.active}
          hint={`${stats.starred} starred · ${stats.total} total`}
        />
        <Metric
          index={3}
          label="Upcoming shows"
          count={rows.length}
          hint={`${home.length} in ${HOME_CITY} · ${elsewhere.length} elsewhere`}
        />
        <Metric
          index={4}
          label="Buy today"
          count={urgent}
          hint={urgent > 0 ? 'early bird open in Bengaluru' : 'nothing urgent'}
        />
        <Metric index={5} label="Items per scan" hint="last 14 scans">
          <div className="mt-1">
            <Sparkline values={activity} />
          </div>
        </Metric>
      </div>

      <form className="mt-5 flex flex-wrap items-center gap-2" action="/">
        <select name="city" defaultValue={city ?? 'all'} className={select} aria-label="City">
          <option value="all">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={priority ?? 'all'}
          className={select}
          aria-label="Priority"
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
        >
          Apply
        </button>
        {city || priority ? (
          <Link href="/" className="px-2 text-sm text-[var(--muted)] hover:text-white">
            Clear
          </Link>
        ) : null}
      </form>

      <Rail
        accent
        title={HOME_CITY}
        note="home city — checked first"
        rows={home}
        empty={`No ${HOME_CITY} shows yet. The scanner only reports announcements it can find published online.`}
      />
      <Rail
        title="Elsewhere in India"
        note="other Indian cities"
        rows={elsewhere}
        empty="Nothing elsewhere in India yet."
      />
    </>
  );
}
