import { desc, sql } from 'drizzle-orm';
import { aiCalls } from '@/db/schema';
import { db } from '@/lib/db';
import { GEMINI_MODEL, ENABLE_GEMINI_GROUNDING } from '@/lib/env';
import { MAX_ITEM_AGE_DAYS } from '@/lib/pipeline/filter';
import {
  ARTIST_BATCH_SIZE,
  STARRED_RECHECK_HOURS,
  UNSTARRED_RECHECK_HOURS,
} from '@/lib/pipeline/batch';
import {
  MAX_PRIORITY_ARTISTS_PER_DAY,
  SWEEP_MIN_GAP_HOURS,
  SWEEP_QUERIES,
  TICKETING_DOMAINS,
} from '@/lib/sources/tavily';
import { EARLY_BIRD_DEADLINE_SOON_HOURS, LOW_CONFIDENCE_MAX } from '@/lib/pipeline/priority';
import { EARLY_BIRD_REMINDER_HOURS } from '@/lib/pipeline/alerts';
import { formatRelative } from '@/lib/time';

export const dynamic = 'force-dynamic';

const COMPONENTS = [
  ['1', 'Scheduler', 'GitHub Actions every 30 min, Vercel cron daily', '.github/workflows/scan.yml, vercel.json'],
  ['2', 'Artist sync', 'Spotify GET /me/following, paste or CSV', 'lib/spotify.ts, app/api/spotify/*'],
  ['3', 'News fetcher', 'Google News RSS', 'lib/sources/google-news.ts'],
  ['4', 'Ticketing search', 'Tavily Search API, include_answer false', 'lib/sources/tavily.ts'],
  ['5', 'Scan orchestrator', 'Next.js route on Vercel', 'app/api/scan/route.ts'],
  ['6', 'Filter', 'url_hash unique key', 'lib/pipeline/filter.ts'],
  ['7', 'Show extractor', 'Gemini Task 1, structured JSON', 'lib/ai/extract.ts'],
  ['8', 'Show matcher', 'dedup_key + Gemini Task 2', 'lib/pipeline/match.ts, lib/ai/reconcile.ts'],
  ['9', 'Prioritiser and alert writer', 'P0-P3 rules + Gemini Task 3', 'lib/pipeline/priority.ts, lib/ai/alert.ts'],
  ['10', 'Notifier', 'Telegram Bot API', 'lib/notify/telegram.ts'],
  ['11', 'Database', 'Postgres on Neon, Drizzle', 'db/schema.ts'],
  ['12', 'Dashboard and logs', 'Next.js pages', 'app/page.tsx, app/scans, app/how-it-works'],
] as const;

const AI_TASKS = [
  {
    task: 'extract',
    title: 'Task 1 — Extract',
    input: 'Artist names with aliases, plus every unprocessed search item for that artist.',
    output: 'A list of show candidates matching the Appendix B JSON schema.',
    file: 'lib/ai/extract.ts',
  },
  {
    task: 'reconcile',
    title: 'Task 2 — Reconcile',
    input: 'A stored show and a new candidate that shares its dedup_key.',
    output: 'same_show, a list of changed fields, and the single material change.',
    file: 'lib/ai/reconcile.ts',
  },
  {
    task: 'alert',
    title: 'Task 3 — Prioritise and write the alert',
    input: 'The show, the home city, and the priority already decided by the rules.',
    output: 'headline, Telegram HTML message, action_by, and the reason for the priority.',
    file: 'lib/ai/alert.ts',
  },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

export default async function HowItWorksPage() {
  const model = GEMINI_MODEL();

  const [stats, latest] = await Promise.all([
    db
      .select({
        task: aiCalls.task,
        model: aiCalls.model,
        calls: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where not ${aiCalls.success})::int`,
        avgMs: sql<number>`coalesce(round(avg(${aiCalls.latencyMs})), 0)::int`,
        inputTokens: sql<number>`coalesce(sum(${aiCalls.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${aiCalls.outputTokens}), 0)::int`,
      })
      .from(aiCalls)
      .groupBy(aiCalls.task, aiCalls.model),
    db.select({ createdAt: aiCalls.createdAt }).from(aiCalls).orderBy(desc(aiCalls.createdAt)).limit(1),
  ]);

  const byTask = new Map(stats.map((row) => [row.task, row]));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-white">How it works</h1>
      <p className="mt-1 max-w-prose text-sm text-zinc-400">
        Live Show Radar watches concert and festival announcements in India for every artist Karan
        follows and alerts him when one appears, with early-bird ticket windows called out first.
        Every AI task runs on Google Gemini Flash. No show is ever hard-coded: the only seeded data
        is the artist list.
      </p>

      <Section title="Components">
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Component</th>
                <th className="px-4 py-2.5 font-medium">Built with</th>
                <th className="px-4 py-2.5 font-medium">Lives in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {COMPONENTS.map(([n, name, built, lives]) => (
                <tr key={n}>
                  <td className="px-4 py-2.5 text-zinc-500">{n}</td>
                  <td className="px-4 py-2.5 font-medium text-white">{name}</td>
                  <td className="px-4 py-2.5">{built}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">{lives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Data sources">
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <h3 className="font-medium text-white">Google News RSS</h3>
            <p className="mt-1 text-zinc-400">
              No key. One query per artist and per alias against the India feed
              (<code className="text-zinc-300">hl=en-IN&amp;gl=IN&amp;ceid=IN:en</code>), restricted
              to the last 14 days with <code className="text-zinc-300">when:14d</code>.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <h3 className="font-medium text-white">Tavily Search API</h3>
            <p className="mt-1 text-zinc-400">
              <code className="text-zinc-300">search_depth: basic</code>,{' '}
              <code className="text-zinc-300">include_answer: false</code>, country India. Platform
              sweeps run at most every {SWEEP_MIN_GAP_HOURS} h across these verified ticketing
              sites: {TICKETING_DOMAINS.join(', ')}. Starred artists get one query a day, capped at{' '}
              {MAX_PRIORITY_ARTISTS_PER_DAY}.
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
              {SWEEP_QUERIES.map((query) => (
                <li key={query}>“{query}”</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <h3 className="font-medium text-white">Spotify Web API</h3>
            <p className="mt-1 text-zinc-400">
              Authorization Code flow, scope <code className="text-zinc-300">user-follow-read</code>,
              cursor-paginated over <code className="text-zinc-300">/me/following</code>. Optional —
              the system works fully on manual and CSV import.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <h3 className="font-medium text-white">Gemini grounding</h3>
            <p className="mt-1 text-zinc-400">
              An optional third source for starred artists, behind{' '}
              <code className="text-zinc-300">ENABLE_GEMINI_GROUNDING</code>. Currently{' '}
              <span className={ENABLE_GEMINI_GROUNDING() ? 'text-emerald-300' : 'text-zinc-300'}>
                {ENABLE_GEMINI_GROUNDING() ? 'on' : 'off'}
              </span>
              .
            </p>
          </div>
        </div>
      </Section>

      <Section title="AI calls">
        <p className="mt-1 text-sm text-zinc-400">
          Every task runs on <code className="text-zinc-200">{model}</code> through the official{' '}
          <code className="text-zinc-200">@google/genai</code> SDK, with structured JSON output
          validated by zod and one retry on invalid output. No other LLM is used anywhere in this
          app. Counts below are live from the <code className="text-zinc-200">ai_calls</code> table
          {latest[0] ? ` — last call ${formatRelative(latest[0].createdAt)}` : ''}.
        </p>
        <div className="mt-3 space-y-3">
          {AI_TASKS.map((task) => {
            const row = byTask.get(task.task);
            return (
              <div
                key={task.task}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-medium text-white">{task.title}</h3>
                  <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-zinc-300">
                    {row?.model ?? model}
                  </code>
                  <span className="ml-auto font-mono text-xs text-zinc-500">{task.file}</span>
                </div>
                <p className="mt-2 text-zinc-400">
                  <span className="text-zinc-500">In:</span> {task.input}
                </p>
                <p className="text-zinc-400">
                  <span className="text-zinc-500">Out:</span> {task.output}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {row
                    ? `${row.calls} calls · ${row.failed} failed · ${row.avgMs} ms average · ${row.inputTokens.toLocaleString('en-IN')} in / ${row.outputTokens.toLocaleString('en-IN')} out tokens`
                    : 'No calls yet.'}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Rules">
        <ul className="mt-3 space-y-2 text-sm text-zinc-400">
          <li>
            <span className="text-zinc-200">Batching.</span> Up to {ARTIST_BATCH_SIZE} due artists
            per scan, starred first. Starred artists return in {STARRED_RECHECK_HOURS} h, the rest
            in {UNSTARRED_RECHECK_HOURS} h, so every function finishes well inside the limit.
          </li>
          <li>
            <span className="text-zinc-200">Deduplication.</span> A{' '}
            <code className="text-zinc-300">url_hash</code> of the canonical URL keeps an article
            from being processed twice; items older than {MAX_ITEM_AGE_DAYS} days are dropped.
            Shows are keyed by{' '}
            <code className="text-zinc-300">artist_id|normalised_city|event_date</code>, with
            Bangalore, Gurgaon, Bombay and New Delhi normalised.
          </li>
          <li>
            <span className="text-zinc-200">Priority, decided in code.</span> P0 Bengaluru with an
            early bird open or imminent; P1 Bengaluru, or any Indian city with an early bird open
            and a deadline inside {EARLY_BIRD_DEADLINE_SOON_HOURS} h; P2 any other Indian city; P3
            confidence below {LOW_CONFIDENCE_MAX}, which is shown on the dashboard but never
            pushed.
          </li>
          <li>
            <span className="text-zinc-200">Alerts.</span> One per{' '}
            <code className="text-zinc-300">show_id|alert_type|channel|change_ref</code>, enforced
            by a unique constraint, so a duplicate is impossible even if two scans overlap. Shows
            whose early-bird window closes within {EARLY_BIRD_REMINDER_HOURS} h get one reminder.
          </li>
          <li>
            <span className="text-zinc-200">Time.</span> Everything is stored in UTC and displayed
            in Asia/Kolkata.
          </li>
        </ul>
      </Section>
    </>
  );
}
