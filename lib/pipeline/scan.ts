import { eq } from 'drizzle-orm';
import { scanRuns } from '@/db/schema';
import { db } from '@/lib/db';
import { errorMessage, mapWithConcurrency } from '@/lib/http';
import { fetchGoogleNews } from '@/lib/sources/google-news';
import {
  SWEEP_QUERIES,
  TICKETING_DOMAINS,
  buildPriorityArtistQuery,
  searchTavily,
} from '@/lib/sources/tavily';
import type { NormalisedItem, SourceError } from '@/lib/sources/types';
import {
  markArtistsChecked,
  pickArtistBatch,
  pickPriorityArtists,
  shouldRunSweep,
  type BatchArtist,
} from '@/lib/pipeline/batch';
import { filterNewItems, insertSourceItems } from '@/lib/pipeline/filter';
import { loadUnprocessedItems, runExtractStage } from '@/lib/pipeline/extract-stage';
import type { RejectionReason } from '@/lib/pipeline/match';
import { artists as artistsTable } from '@/db/schema';

export const FETCH_CONCURRENCY = 5;
export const FETCH_TIMEOUT_MS = 10_000;

export type ScanTrigger = 'github_actions' | 'vercel_cron' | 'manual';

export type ScanSummary = {
  scanRunId: string;
  trigger: ScanTrigger;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  artistsScanned: number;
  artistNames: string[];
  sweepRan: boolean;
  priorityArtistChecks: number;
  itemsFetched: number;
  itemsNew: number;
  geminiCalls: number;
  rejectedCandidates: Record<RejectionReason, number>;
  showsNew: number;
  showsUpdated: number;
  alertsSent: number;
  errors: SourceError[];
};

/** One fetch unit: an artist name, one of its aliases, or a sweep query. */
type FetchJob =
  | { kind: 'google_news'; term: string; artist: BatchArtist }
  | { kind: 'tavily_artist'; artist: BatchArtist }
  | { kind: 'tavily_sweep'; query: string };

function buildJobs(batch: readonly BatchArtist[], priority: readonly BatchArtist[], sweep: boolean) {
  const jobs: FetchJob[] = [];

  for (const artist of batch) {
    // The artist's own name plus every alias, each its own Google News query.
    for (const term of [artist.name, ...artist.aliases]) {
      jobs.push({ kind: 'google_news', term, artist });
    }
  }

  for (const artist of priority) jobs.push({ kind: 'tavily_artist', artist });

  if (sweep) {
    for (const query of SWEEP_QUERIES) jobs.push({ kind: 'tavily_sweep', query });
  }

  return jobs;
}

async function runJob(job: FetchJob) {
  switch (job.kind) {
    case 'google_news':
      return fetchGoogleNews(job.term, job.artist.id, FETCH_TIMEOUT_MS);
    case 'tavily_artist':
      return searchTavily(buildPriorityArtistQuery(job.artist.name), {
        artistId: job.artist.id,
        timeoutMs: FETCH_TIMEOUT_MS,
      });
    case 'tavily_sweep':
      // Sweeps are not tied to one artist; they are scoped to ticketing sites.
      return searchTavily(job.query, {
        artistId: null,
        includeDomains: TICKETING_DOMAINS,
        timeoutMs: FETCH_TIMEOUT_MS,
      });
  }
}

/**
 * The scan orchestrator. A failure in one source or one artist is recorded in
 * `errors` and never fails the run.
 */
export async function runScan(trigger: ScanTrigger): Promise<ScanSummary> {
  const now = new Date();

  const [run] = await db.insert(scanRuns).values({ trigger }).returning();
  if (!run) throw new Error('Could not open a scan run');

  const errors: SourceError[] = [];
  let batch: BatchArtist[] = [];
  let sweepRan = false;
  let priorityArtists: BatchArtist[] = [];
  let itemsFetched = 0;
  let itemsNew = 0;
  let geminiCalls = 0;
  let showsNew = 0;
  let rejectedCandidates: Record<RejectionReason, number> = {
    not_a_show_announcement: 0,
    not_india: 0,
    low_confidence: 0,
    past_event: 0,
    no_city: 0,
    unknown_artist: 0,
  };

  try {
    batch = await pickArtistBatch(undefined, now);
    const sweepDue = await shouldRunSweep(now);
    priorityArtists = await pickPriorityArtists(batch, now);

    const jobs = buildJobs(batch, priorityArtists, sweepDue);
    sweepRan = sweepDue && jobs.some((job) => job.kind === 'tavily_sweep');

    const settled = await mapWithConcurrency(jobs, FETCH_CONCURRENCY, runJob);

    const collected: NormalisedItem[] = [];
    settled.forEach((result, index) => {
      const job = jobs[index];
      if (result.status === 'fulfilled') {
        collected.push(...result.value.items);
        errors.push(...result.value.errors);
      } else {
        // mapWithConcurrency already isolates throws; this is belt and braces.
        errors.push({
          source: job.kind === 'google_news' ? 'google_news' : 'tavily',
          query: job.kind === 'google_news' ? job.term : 'sweep',
          message: errorMessage(result.reason),
        });
      }
    });

    const { fetched, fresh } = await filterNewItems(collected, now);
    itemsFetched = fetched.length;
    itemsNew = await insertSourceItems(fresh, run.id);

    // Extract from everything still unprocessed, not only this run's fetch, so
    // a backlog from an interrupted scan is always picked up.
    const pending = await loadUnprocessedItems(batch);
    if (pending.length > 0) {
      // Sweep items are matched against every artist, not just this batch.
      const allArtists = await db.select().from(artistsTable);
      const extract = await runExtractStage(batch, allArtists, pending, {
        scanRunId: run.id,
        now,
      });
      geminiCalls = extract.geminiCalls;
      showsNew = extract.newShows.length;
      rejectedCandidates = extract.rejections;
      errors.push(...extract.errors);
    }

    await markArtistsChecked(batch, now);
  } catch (error) {
    errors.push({ source: 'google_news', query: 'scan', message: errorMessage(error) });
  }

  const finishedAt = new Date();

  await db
    .update(scanRuns)
    .set({
      finishedAt,
      artistsScanned: batch.length,
      sweepRan,
      itemsFetched,
      itemsNew,
      geminiCalls,
      showsNew,
      errors,
    })
    .where(eq(scanRuns.id, run.id));

  return {
    scanRunId: run.id,
    trigger,
    startedAt: run.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - run.startedAt.getTime(),
    artistsScanned: batch.length,
    artistNames: batch.map((artist) => artist.name),
    sweepRan,
    priorityArtistChecks: priorityArtists.length,
    itemsFetched,
    itemsNew,
    geminiCalls,
    showsNew,
    rejectedCandidates,
    // Task 2 reconcile and Task 3 alerts arrive in M4.
    showsUpdated: 0,
    alertsSent: 0,
    errors,
  };
}
