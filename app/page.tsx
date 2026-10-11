import { ShowCard } from '@/components/show-card';
import { HOME_CITY } from '@/lib/cities';
import {
  getArtistStats,
  getDistinctCities,
  getLastScan,
  getNextCheckAt,
  getUpcomingShows,
  splitByCity,
  type ShowWithArtist,
} from '@/lib/queries';
import { formatIstDateTime, formatRelative } from '@/lib/time';

export const dynamic = 'force-dynamic';

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function Section({
  title, subtitle, rows, emptyNote,
}: {
  title: string;
  subtitle: string;
  rows: ShowWithArtist[];
  emptyNote: string;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-xs text-zinc-500">{subtitle}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">
          {emptyNote}
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <ShowCard key={row.show.id} row={row} />
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

  const [rows, lastScan, nextCheckAt, stats, cities] = await Promise.all([
    getUpcomingShows({ city, priority }),
    getLastScan(),
    getNextCheckAt(),
    getArtistStats(),
    getDistinctCities(),
  ]);

  const { home, elsewhere } = splitByCity(rows);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Live shows on the radar
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Concert and festival announcements in India for every artist Karan follows, with
          early-bird ticket windows called out first.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Last scan"
          value={lastScan ? formatRelative(lastScan.startedAt) : 'no scans yet'}
          hint={lastScan ? formatIstDateTime(lastScan.startedAt) : 'run one from /scans'}
        />
        <Stat
          label="Next scan due"
          value={nextCheckAt ? formatRelative(nextCheckAt).replace(' ago', ' overdue') : '—'}
          hint={nextCheckAt ? formatIstDateTime(nextCheckAt) : 'no active artists'}
        />
        <Stat
          label="Artists watched"
          value={`${stats.active} active`}
          hint={`${stats.starred} starred · ${stats.total} total`}
        />
        <Stat
          label="Upcoming shows"
          value={`${rows.length} found`}
          hint={`${home.length} in ${HOME_CITY}`}
        />
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3 text-sm" action="/">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-500">City</span>
          <select
            name="city"
            defaultValue={city ?? 'all'}
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-zinc-200"
          >
            <option value="all">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Priority</span>
          <select
            name="priority"
            defaultValue={priority ?? 'all'}
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-zinc-200"
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-zinc-200 hover:border-white/30"
        >
          Apply
        </button>
      </form>

      <Section
        title={HOME_CITY}
        subtitle="home city — checked first"
        rows={home}
        emptyNote={`No ${HOME_CITY} shows on the radar yet. The scanner only reports announcements it can find published online.`}
      />
      <Section
        title="Elsewhere in India"
        subtitle="other Indian cities"
        rows={elsewhere}
        emptyNote="Nothing elsewhere in India yet."
      />
    </>
  );
}
