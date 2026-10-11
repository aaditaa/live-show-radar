import { and, asc, desc, eq, isNotNull, lte, max, sql } from 'drizzle-orm';
import { artists, scanRuns, sourceItems } from '@/db/schema';
import { db } from '@/lib/db';
import {
  MAX_PRIORITY_ARTISTS_PER_DAY,
  PRIORITY_CHECK_MIN_GAP_HOURS,
  SWEEP_MIN_GAP_HOURS,
} from '@/lib/sources/tavily';

export const ARTIST_BATCH_SIZE = 15;
export const STARRED_RECHECK_HOURS = 2;
export const UNSTARRED_RECHECK_HOURS = 6;

export type BatchArtist = typeof artists.$inferSelect;

/**
 * Up to 15 active artists that are due, starred first then oldest next_check_at.
 * Filtering on next_check_at is what makes the +2 h / +6 h schedule mean
 * anything — without it every scan would re-check the same starred artists.
 */
export async function pickArtistBatch(
  limit: number = ARTIST_BATCH_SIZE,
  now: Date = new Date(),
): Promise<BatchArtist[]> {
  return db
    .select()
    .from(artists)
    .where(and(eq(artists.isActive, true), lte(artists.nextCheckAt, now)))
    .orderBy(desc(artists.isStarred), asc(artists.nextCheckAt))
    .limit(limit);
}

/** The platform sweep runs at most every 6 hours, across all scans. */
export async function shouldRunSweep(now: Date = new Date()): Promise<boolean> {
  const rows = await db
    .select({ startedAt: scanRuns.startedAt })
    .from(scanRuns)
    .where(eq(scanRuns.sweepRan, true))
    .orderBy(desc(scanRuns.startedAt))
    .limit(1);

  const last = rows[0]?.startedAt;
  if (!last) return true;
  return now.getTime() - last.getTime() >= SWEEP_MIN_GAP_HOURS * 60 * 60 * 1000;
}

/**
 * Starred artists get one Tavily query a day, at most 10 a day. Eligibility is
 * derived from when we last stored a Tavily item for that artist, so it needs
 * no extra column and survives restarts.
 */
export async function pickPriorityArtists(
  batch: readonly BatchArtist[],
  now: Date = new Date(),
  maxArtists: number = MAX_PRIORITY_ARTISTS_PER_DAY,
): Promise<BatchArtist[]> {
  const starred = batch.filter((artist) => artist.isStarred);
  if (starred.length === 0) return [];

  const rows = await db
    .select({ artistId: sourceItems.artistId, lastAt: max(sourceItems.fetchedAt) })
    .from(sourceItems)
    .where(and(eq(sourceItems.source, 'tavily'), isNotNull(sourceItems.artistId)))
    .groupBy(sourceItems.artistId);

  const lastChecked = new Map(rows.map((row) => [row.artistId, row.lastAt]));
  const gapMs = PRIORITY_CHECK_MIN_GAP_HOURS * 60 * 60 * 1000;

  return starred
    .filter((artist) => {
      const last = lastChecked.get(artist.id);
      return !last || now.getTime() - new Date(last).getTime() >= gapMs;
    })
    .slice(0, maxArtists);
}

/** Starred artists come back round in 2 hours, everyone else in 6. */
export function nextCheckAt(artist: { isStarred: boolean }, now: Date = new Date()): Date {
  const hours = artist.isStarred ? STARRED_RECHECK_HOURS : UNSTARRED_RECHECK_HOURS;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export async function markArtistsChecked(
  batch: readonly BatchArtist[],
  now: Date = new Date(),
): Promise<void> {
  if (batch.length === 0) return;

  // One statement: CASE on is_starred rather than a query per artist.
  await db
    .update(artists)
    .set({
      lastCheckedAt: now,
      nextCheckAt: sql`now() + case when ${artists.isStarred} then interval '${sql.raw(
        String(STARRED_RECHECK_HOURS),
      )} hours' else interval '${sql.raw(String(UNSTARRED_RECHECK_HOURS))} hours' end`,
    })
    .where(
      sql`${artists.id} in (${sql.join(
        batch.map((artist) => sql`${artist.id}::uuid`),
        sql`, `,
      )})`,
    );
}
