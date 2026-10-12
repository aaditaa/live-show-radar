import { and, desc, inArray, isNull, or } from 'drizzle-orm';
import { rejections, sourceItems, type Show, type SourceItem } from '@/db/schema';
import { db } from '@/lib/db';
import { mapWithConcurrency } from '@/lib/http';
import { extractShows, type ExtractInputArtist } from '@/lib/ai/extract';
import type { ShowCandidate } from '@/lib/ai/schemas';
import type { BatchArtist } from '@/lib/pipeline/batch';
import {
  findExistingShows,
  insertNewShows,
  triageCandidates,
  type AcceptedCandidate,
  type RejectionReason,
} from '@/lib/pipeline/match';
import type { SourceError } from '@/lib/sources/types';

export const EXTRACT_CONCURRENCY = 3;

/**
 * How many unprocessed items one scan will hand to Gemini. Bounds both the
 * run time and the token spend when a backlog has built up.
 */
export const MAX_ITEMS_PER_SCAN = 400;

export type ExtractStageResult = {
  geminiCalls: number;
  newShows: Show[];
  /** Accepted candidates whose show already existed — Task 2 handles these in M4. */
  existingMatches: { accepted: AcceptedCandidate; existing: Show }[];
  rejections: Record<RejectionReason, number>;
  errors: SourceError[];
};

type ExtractUnit = {
  label: string;
  artists: ExtractInputArtist[];
  items: SourceItem[];
};

/**
 * Items this scan should extract: anything never sent to Gemini that belongs
 * to an artist in this batch, plus unprocessed platform-sweep items. Reading
 * from `processed_at` rather than from this run's fetch means a scan that dies
 * mid-way leaves work for the next one instead of stranding it.
 */
export async function loadUnprocessedItems(
  batch: readonly BatchArtist[],
  limit: number = MAX_ITEMS_PER_SCAN,
): Promise<SourceItem[]> {
  const artistIds = batch.map((artist) => artist.id);

  const scope =
    artistIds.length > 0
      ? or(inArray(sourceItems.artistId, artistIds), isNull(sourceItems.artistId))
      : isNull(sourceItems.artistId);

  return db
    .select()
    .from(sourceItems)
    .where(and(isNull(sourceItems.processedAt), scope))
    .orderBy(desc(sourceItems.fetchedAt))
    .limit(limit);
}

/** Normalise a name for matching Gemini's `artist_name` back to a row. */
function matchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * One Gemini call per artist that has new items, plus one call for the sweep
 * items with the full artist list so Gemini can match them itself.
 */
export function buildExtractUnits(
  batch: readonly BatchArtist[],
  allArtists: readonly BatchArtist[],
  pendingItems: readonly SourceItem[],
): ExtractUnit[] {
  const units: ExtractUnit[] = [];
  const byArtist = new Map<string, SourceItem[]>();
  const sweepItems: SourceItem[] = [];

  for (const item of pendingItems) {
    if (item.artistId === null) {
      sweepItems.push(item);
      continue;
    }
    const existing = byArtist.get(item.artistId);
    if (existing) existing.push(item);
    else byArtist.set(item.artistId, [item]);
  }

  for (const artist of batch) {
    const items = byArtist.get(artist.id);
    // An artist with zero new items never reaches Gemini.
    if (!items || items.length === 0) continue;
    units.push({
      label: artist.name,
      artists: [{ name: artist.name, aliases: artist.aliases }],
      items,
    });
  }

  if (sweepItems.length > 0) {
    units.push({
      label: 'platform sweep',
      artists: allArtists.map((artist) => ({ name: artist.name, aliases: artist.aliases })),
      items: sweepItems,
    });
  }

  return units;
}

function emptyRejections(): Record<RejectionReason, number> {
  return {
    not_a_show_announcement: 0,
    not_india: 0,
    low_confidence: 0,
    past_event: 0,
    no_city: 0,
    unknown_artist: 0,
  };
}

export async function runExtractStage(
  batch: readonly BatchArtist[],
  allArtists: readonly BatchArtist[],
  pendingItems: readonly SourceItem[],
  options: { scanRunId: string; now?: Date },
): Promise<ExtractStageResult> {
  const now = options.now ?? new Date();
  const units = buildExtractUnits(batch, allArtists, pendingItems);

  const result: ExtractStageResult = {
    geminiCalls: 0,
    newShows: [],
    existingMatches: [],
    rejections: emptyRejections(),
    errors: [],
  };

  if (units.length === 0) return result;

  const settled = await mapWithConcurrency(units, EXTRACT_CONCURRENCY, (unit) =>
    extractShows(unit.artists, unit.items, { scanRunId: options.scanRunId, today: now }),
  );

  const candidates: ShowCandidate[] = [];
  settled.forEach((outcome, index) => {
    const unit = units[index];
    result.geminiCalls += 1;
    if (outcome.status === 'fulfilled') {
      if (outcome.value.error) {
        result.errors.push({
          source: 'gemini_search',
          query: `extract: ${unit.label}`,
          message: outcome.value.error,
        });
      }
      candidates.push(...outcome.value.shows);
    } else {
      result.errors.push({
        source: 'gemini_search',
        query: `extract: ${unit.label}`,
        message: String(outcome.reason),
      });
    }
  });

  // Gemini answers with a name; map it back to the artist row it belongs to.
  const byKey = new Map<string, string>();
  for (const artist of allArtists) {
    byKey.set(matchKey(artist.name), artist.id);
    for (const alias of artist.aliases) byKey.set(matchKey(alias), artist.id);
  }
  const resolveArtistId = (name: string) => byKey.get(matchKey(name)) ?? null;

  const { accepted, rejected } = triageCandidates(candidates, resolveArtistId, now);
  for (const rejection of rejected) result.rejections[rejection.reason] += 1;

  // Keep what was refused and why. Rejection is the hard part of this
  // pipeline, so it is evidence, not a statistic.
  if (rejected.length > 0) {
    await db
      .insert(rejections)
      .values(
        rejected.slice(0, 60).map(({ candidate, reason }) => ({
          scanRunId: options.scanRunId,
          artistId: resolveArtistId(candidate.artist_name),
          claimedArtist: candidate.artist_name,
          reason,
          country: candidate.country,
          city: candidate.city,
          eventDate: candidate.event_date,
          confidence: String(candidate.artist_match_confidence),
          evidence: candidate.evidence,
          sourceUrl: candidate.source_url,
        })),
      )
      .catch(() => undefined);
  }

  const existing = await findExistingShows(accepted.map((item) => item.dedupKey));
  const fresh = accepted.filter((item) => !existing.has(item.dedupKey));

  for (const item of accepted) {
    const match = existing.get(item.dedupKey);
    if (match) result.existingMatches.push({ accepted: item, existing: match });
  }

  result.newShows = await insertNewShows(fresh, now);

  // Mark everything we handed to Gemini as processed, so it is not re-sent.
  const processedIds = units.flatMap((unit) => unit.items.map((item) => item.id));
  for (let i = 0; i < processedIds.length; i += 500) {
    await db
      .update(sourceItems)
      .set({ processedAt: now })
      .where(inArray(sourceItems.id, processedIds.slice(i, i + 500)));
  }

  return result;
}
