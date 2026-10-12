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
import { PageHeader } from '@/components/page-header';

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
    task: 'suggest',
    title: 'Suggest — artists worth following',
    input: 'Every artist currently followed, starred ones weighted first.',
    output: 'Similar artists likely to play India, each with the artist it resembles.',
    file: 'lib/ai/suggest.ts',
  },
  {
    task: 'ground',
    title: 'Ground — Gemini search as a third source',
    input: 'A starred artist, when ENABLE_GEMINI_GROUNDING is on.',
    output: 'The URLs the model grounded on, fed back through Task 1 like any other source.',
    file: 'lib/sources/gemini-grounding.ts',
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
      <h2 className="text-[15px] font-semibold">{title}</h2>
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
      <PageHeader
        title="How it works"
        subtitle="Live Show Radar watches concert and festival announcements in India for every artist Karan follows and alerts him when one appears, with early-bird ticket windows called out first. Every AI task runs on Google Gemini Flash. No show is ever hard-coded: the only seeded data is the artist list."
      />

      <Section title="Components">
        <div className="panel mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted-dim)]">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Component</th>
                <th className="px-4 py-3 font-medium">Built with</th>
                <th className="px-4 py-3 font-medium">Lives in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-[var(--muted)]">
              {COMPONENTS.map(([n, name, built, lives]) => (
                <tr key={n}>
                  <td className="px-4 py-3 text-[var(--muted-dim)]">{n}</td>
                  <td className="px-4 py-3 font-medium text-white">{name}</td>
                  <td className="px-4 py-3">{built}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted-dim)]">{lives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Data sources">
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="panel p-5 text-sm">
            <h3 className="font-semibold">Google News RSS</h3>
            <p className="mt-1 leading-relaxed text-[var(--muted)]">
              No key. One query per artist and per alias against the India feed
              (<code className="text-white">hl=en-IN&amp;gl=IN&amp;ceid=IN:en</code>), restricted
              to the last 14 days with <code className="text-white">when:14d</code>.
            </p>
          </div>
          <div className="panel p-5 text-sm">
            <h3 className="font-semibold">Tavily Search API</h3>
            <p className="mt-1 leading-relaxed text-[var(--muted)]">
              <code className="text-white">search_depth: basic</code>,{' '}
              <code className="text-white">include_answer: false</code>, country India. Platform
              sweeps run at most every {SWEEP_MIN_GAP_HOURS} h across these verified ticketing
              sites: {TICKETING_DOMAINS.join(', ')}. Starred artists get one query a day, capped at{' '}
              {MAX_PRIORITY_ARTISTS_PER_DAY}.
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted-dim)]">
              {SWEEP_QUERIES.map((query) => (
                <li key={query}>“{query}”</li>
              ))}
            </ul>
          </div>
          <div className="panel p-5 text-sm">
            <h3 className="font-semibold">Spotify Web API</h3>
            <p className="mt-1 leading-relaxed text-[var(--muted)]">
              Authorization Code flow, scope <code className="text-white">user-follow-read</code>,
              cursor-paginated over <code className="text-white">/me/following</code>. Optional —
              the system works fully on manual and CSV import.
            </p>
          </div>
          <div className="panel p-5 text-sm">
            <h3 className="font-semibold">Gemini grounding</h3>
            <p className="mt-1 leading-relaxed text-[var(--muted)]">
              A third source for starred artists using the <code className="text-white">google_search</code>{' '}
              tool, behind <code className="text-white">ENABLE_GEMINI_GROUNDING</code>. Grounding
              cannot be combined with structured output, so it is used for discovery only: the
              URLs it finds go through Task 1 like any other source, and nothing the model says
              is trusted directly. Currently{' '}
              <span className={ENABLE_GEMINI_GROUNDING() ? 'text-emerald-300' : 'text-zinc-300'}>
                {ENABLE_GEMINI_GROUNDING() ? 'on' : 'off'}
              </span>
              .
            </p>
          </div>
        </div>
      </Section>

      <Section title="AI calls">
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Every task runs on <code className="font-medium text-white">{model}</code> through the official{' '}
          <code className="font-medium text-white">@google/genai</code> SDK, with structured JSON output
          validated by zod and one retry on invalid output. No other LLM is used anywhere in this
          app. Counts below are live from the <code className="font-medium text-white">ai_calls</code> table
          {latest[0] ? ` — last call ${formatRelative(latest[0].createdAt)}` : ''}.
        </p>
        <div className="mt-3 space-y-3">
          {AI_TASKS.map((task) => {
            const row = byTask.get(task.task);
            return (
              <div
                key={task.task}
                className="panel p-5 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-semibold">{task.title}</h3>
                  <code className="rounded-md border border-[var(--line)] bg-[var(--panel-raised)] px-1.5 py-0.5 text-xs">
                    {row?.model ?? model}
                  </code>
                  <span className="ml-auto font-mono text-xs text-[var(--muted-dim)]">{task.file}</span>
                </div>
                <p className="mt-2 text-[var(--muted)]">
                  <span className="text-zinc-500">In:</span> {task.input}
                </p>
                <p className="text-[var(--muted)]">
                  <span className="text-zinc-500">Out:</span> {task.output}
                </p>
                <p className="mt-2 text-xs text-[var(--muted-dim)]">
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
        <ul className="panel mt-3 space-y-3 p-5 text-sm leading-relaxed text-[var(--muted)]">
          <li>
            <span className="font-medium text-white">Batching.</span> Up to {ARTIST_BATCH_SIZE} due artists
            per scan, starred first. Starred artists return in {STARRED_RECHECK_HOURS} h, the rest
            in {UNSTARRED_RECHECK_HOURS} h, so every function finishes well inside the limit.
          </li>
          <li>
            <span className="font-medium text-white">Deduplication.</span> A{' '}
            <code className="text-white">url_hash</code> of the canonical URL keeps an article
            from being processed twice; items older than {MAX_ITEM_AGE_DAYS} days are dropped.
            Shows are keyed by{' '}
            <code className="text-white">artist_id|normalised_city|event_date</code>, with
            Bangalore, Gurgaon, Bombay and New Delhi normalised.
          </li>
          <li>
            <span className="font-medium text-white">Priority, decided in code.</span> P0 Bengaluru with an
            early bird open or imminent; P1 Bengaluru, or any Indian city with an early bird open
            and a deadline inside {EARLY_BIRD_DEADLINE_SOON_HOURS} h; P2 any other Indian city; P3
            confidence below {LOW_CONFIDENCE_MAX}, which is shown on the dashboard but never
            pushed.
          </li>
          <li>
            <span className="font-medium text-white">Alerts.</span> One per{' '}
            <code className="text-white">show_id|alert_type|channel|change_ref</code>, enforced
            by a unique constraint, so a duplicate is impossible even if two scans overlap. Shows
            whose early-bird window closes within {EARLY_BIRD_REMINDER_HOURS} h get one reminder.
          </li>
          <li>
            <span className="font-medium text-white">Time.</span> Everything is stored in UTC and displayed
            in Asia/Kolkata.
          </li>
        </ul>
      </Section>
    </>
  );
}
