import { desc, sql } from 'drizzle-orm';
import { aiCalls, scanRuns } from '@/db/schema';
import { db } from '@/lib/db';
import { Flash } from '@/components/flash';
import { PageHeader } from '@/components/page-header';
import { formatIstDateTime, formatRelative } from '@/lib/time';

export const dynamic = 'force-dynamic';

const TRIGGER_LABEL: Record<string, string> = {
  github_actions: 'GitHub Actions',
  vercel_cron: 'Vercel cron',
  manual: 'Manual',
};

type ScanError = { source?: string; query?: string; message?: string };

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted-dim)]">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const params = await searchParams;

  const [runs, aiByRun] = await Promise.all([
    db.select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(40),
    db
      .select({
        scanRunId: aiCalls.scanRunId,
        calls: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where not ${aiCalls.success})::int`,
        inputTokens: sql<number>`coalesce(sum(${aiCalls.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${aiCalls.outputTokens}), 0)::int`,
      })
      .from(aiCalls)
      .groupBy(aiCalls.scanRunId),
  ]);

  const aiStats = new Map(aiByRun.map((row) => [row.scanRunId, row]));

  const totals = runs.reduce(
    (acc, run) => ({
      items: acc.items + run.itemsNew,
      shows: acc.shows + run.showsNew,
      alerts: acc.alerts + run.alertsSent,
    }),
    { items: 0, shows: 0, alerts: 0 },
  );

  return (
    <>
      <PageHeader
        title="Scans"
        subtitle={`Last ${runs.length} scans · ${totals.items} new items · ${totals.shows} new shows · ${totals.alerts} alerts sent. A scan runs every 30 minutes from GitHub Actions, with a daily Vercel cron at 08:00 IST as backup.`}
      />
      <Flash done={params.done} error={params.error} />

      {runs.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
          No scans yet.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {runs.map((run) => {
            const ai = aiStats.get(run.id);
            const errors = (run.errors as ScanError[]) ?? [];
            const seconds = run.finishedAt
              ? ((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000).toFixed(1)
              : null;

            return (
              <article
                key={run.id}
                className="panel p-5"
              >
                <header className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full border border-[var(--line)] bg-[var(--panel-raised)] px-2.5 py-0.5 text-[11px] font-medium">
                    {TRIGGER_LABEL[run.trigger] ?? run.trigger}
                  </span>
                  <span className="text-[var(--muted)]">{formatIstDateTime(run.startedAt)}</span>
                  <span className="text-xs text-[var(--muted-dim)]">
                    {formatRelative(run.startedAt)}
                    {seconds ? ` · ${seconds}s` : ' · running'}
                  </span>
                  {run.sweepRan ? (
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300 ring-1 ring-inset ring-sky-500/20">
                      platform sweep
                    </span>
                  ) : null}
                  {errors.length > 0 ? (
                    <span className="ml-auto rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300 ring-1 ring-inset ring-rose-500/30">
                      {errors.length} error{errors.length === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span className="ml-auto text-xs text-emerald-400">no errors</span>
                  )}
                </header>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-7">
                  <Metric label="Artists" value={run.artistsScanned} />
                  <Metric label="Fetched" value={run.itemsFetched} />
                  <Metric label="New" value={run.itemsNew} />
                  <Metric label="Gemini" value={ai?.calls ?? run.geminiCalls} />
                  <Metric label="Shows" value={run.showsNew} />
                  <Metric label="Updated" value={run.showsUpdated} />
                  <Metric label="Alerts" value={run.alertsSent} />
                </dl>

                {ai && ai.calls > 0 ? (
                  <p className="mt-2 text-xs text-[var(--muted-dim)]">
                    {ai.inputTokens.toLocaleString('en-IN')} input /{' '}
                    {ai.outputTokens.toLocaleString('en-IN')} output tokens
                    {ai.failed > 0 ? ` · ${ai.failed} failed call${ai.failed === 1 ? '' : 's'}` : ''}
                  </p>
                ) : null}

                {errors.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-[var(--line)] pt-3">
                    {errors.slice(0, 6).map((error, index) => (
                      <li key={index} className="text-xs text-rose-300/80">
                        <span className="text-zinc-500">{error.source ?? 'unknown'}</span>
                        {error.query ? <span className="text-zinc-600"> · {error.query}</span> : null}
                        {' — '}
                        {error.message}
                      </li>
                    ))}
                    {errors.length > 6 ? (
                      <li className="text-xs text-[var(--muted-dim)]">
                        and {errors.length - 6} more
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
