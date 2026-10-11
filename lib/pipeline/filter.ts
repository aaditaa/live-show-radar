import { inArray } from 'drizzle-orm';
import { sourceItems } from '@/db/schema';
import { db } from '@/lib/db';
import { urlHash } from '@/lib/url';
import type { NormalisedItem } from '@/lib/sources/types';

export const MAX_ITEM_AGE_DAYS = 30;

export type HashedItem = NormalisedItem & { urlHash: string };

/** Items published more than 30 days ago are stale. No date means keep it. */
export function isWithinAgeWindow(
  item: NormalisedItem,
  now: Date = new Date(),
  maxAgeDays: number = MAX_ITEM_AGE_DAYS,
): boolean {
  if (!item.publishedAt) return true;
  const ageMs = now.getTime() - item.publishedAt.getTime();
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

/**
 * Hash every item, drop stale ones, and collapse duplicates inside this batch.
 * Two sources finding the same article must produce one row, so the first
 * occurrence wins.
 */
export function dedupeWithinBatch(
  items: readonly NormalisedItem[],
  now: Date = new Date(),
): HashedItem[] {
  const seen = new Set<string>();
  const kept: HashedItem[] = [];

  for (const item of items) {
    if (!isWithinAgeWindow(item, now)) continue;
    const hash = urlHash(item.url);
    if (seen.has(hash)) continue;
    seen.add(hash);
    kept.push({ ...item, urlHash: hash });
  }

  return kept;
}

/** Which of these hashes are already in `source_items` from an earlier scan. */
export async function findKnownHashes(hashes: readonly string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();

  const known = new Set<string>();
  // Chunked so a large batch never builds an oversized IN list.
  const CHUNK = 500;
  for (let i = 0; i < hashes.length; i += CHUNK) {
    const rows = await db
      .select({ urlHash: sourceItems.urlHash })
      .from(sourceItems)
      .where(inArray(sourceItems.urlHash, hashes.slice(i, i + CHUNK)));
    for (const row of rows) known.add(row.urlHash);
  }
  return known;
}

export type FilterResult = {
  /** Everything that survived hashing and the age window. */
  fetched: HashedItem[];
  /** The subset not seen in any previous scan. */
  fresh: HashedItem[];
};

export async function filterNewItems(
  items: readonly NormalisedItem[],
  now: Date = new Date(),
): Promise<FilterResult> {
  const fetched = dedupeWithinBatch(items, now);
  const known = await findKnownHashes(fetched.map((item) => item.urlHash));
  return { fetched, fresh: fetched.filter((item) => !known.has(item.urlHash)) };
}

/**
 * Insert the fresh items. `onConflictDoNothing` on url_hash makes this safe
 * against two scans racing, and returns only the rows that actually landed.
 */
export async function insertSourceItems(
  items: readonly HashedItem[],
  scanRunId: string,
): Promise<number> {
  if (items.length === 0) return 0;

  const inserted = await db
    .insert(sourceItems)
    .values(
      items.map((item) => ({
        scanRunId,
        artistId: item.artistId,
        source: item.source,
        query: item.query,
        url: item.url,
        urlHash: item.urlHash,
        title: item.title,
        snippet: item.snippet,
        publishedAt: item.publishedAt,
      })),
    )
    .onConflictDoNothing({ target: sourceItems.urlHash })
    .returning({ id: sourceItems.id });

  return inserted.length;
}
