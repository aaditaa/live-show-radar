import { and, eq, isNull, sql } from 'drizzle-orm';
import { artistSuggestions, artists, type User } from '@/db/schema';
import { db } from '@/lib/db';
import { findArtistImage, getAccessToken, getFollowedArtists } from '@/lib/spotify';
import { errorMessage, mapWithConcurrency } from '@/lib/http';

export type ImportedArtist = { name: string; aliases: string[] };

/**
 * Parse pasted text or CSV. One artist per line; an optional second column of
 * comma-separated aliases, quoted when it contains commas:
 *
 *   Prateek Kuhad
 *   Ritviz, "Ritviz Srivastava"
 *   The Peter Cat Recording Co., "Peter Cat Recording Co, PCRC"
 */
export function parseArtistInput(raw: string): ImportedArtist[] {
  const seen = new Set<string>();
  const parsed: ImportedArtist[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip a CSV header row rather than importing an artist called "name".
    if (/^"?name"?\s*(,|$)/i.test(trimmed)) continue;

    const fields = splitCsvLine(trimmed);
    const name = fields[0]?.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const aliases = fields
      .slice(1)
      .flatMap((field) => field.split(','))
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0 && alias.toLowerCase() !== key);

    parsed.push({ name, aliases: [...new Set(aliases)] });
  }

  return parsed;
}

/** Minimal CSV field splitter that respects double quotes. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export type ImportResult = { added: number; skipped: number; names: string[] };

export async function importArtists(
  user: User,
  input: string,
  source: 'manual' = 'manual',
): Promise<ImportResult> {
  const parsed = parseArtistInput(input);
  if (parsed.length === 0) return { added: 0, skipped: 0, names: [] };

  const inserted = await db
    .insert(artists)
    .values(
      parsed.map((artist) => ({
        userId: user.id,
        name: artist.name,
        aliases: artist.aliases,
        source,
      })),
    )
    // An artist already on the list is left exactly as it is.
    .onConflictDoNothing()
    .returning({ name: artists.name });

  return {
    added: inserted.length,
    skipped: parsed.length - inserted.length,
    names: inserted.map((row) => row.name),
  };
}

export type SyncResult = {
  fetched: number;
  added: number;
  reactivated: number;
  unfollowed: number;
};

/**
 * Sync the Spotify follow list.
 *
 * Artists added manually or seeded as demo data are never touched: unfollowing
 * on Spotify only deactivates rows whose source is 'spotify'. Deactivation,
 * not deletion, so their history and shows survive.
 */
export async function syncSpotifyArtists(user: User): Promise<SyncResult> {
  const accessToken = await getAccessToken(user);
  if (!accessToken) throw new Error('Spotify is not connected for this user');

  const followed = await getFollowedArtists(accessToken);
  const followedIds = new Set(followed.map((artist) => artist.id));

  let added = 0;
  let reactivated = 0;

  if (followed.length > 0) {
    const inserted = await db
      .insert(artists)
      .values(
        followed.map((artist) => ({
          userId: user.id,
          name: artist.name,
          aliases: [] as string[],
          spotifyId: artist.id,
          imageUrl: artist.imageUrl,
          source: 'spotify' as const,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: artists.id });
    added = inserted.length;

    // Someone re-followed an artist that had been deactivated.
    const restored = await db
      .update(artists)
      .set({ isActive: true })
      .where(
        and(
          eq(artists.userId, user.id),
          eq(artists.source, 'spotify'),
          eq(artists.isActive, false),
          sql`${artists.spotifyId} in (${sql.join(
            [...followedIds].map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      )
      .returning({ id: artists.id });
    reactivated = restored.length;
  }

  const deactivated = await db
    .update(artists)
    .set({ isActive: false })
    .where(
      and(
        eq(artists.userId, user.id),
        eq(artists.source, 'spotify'),
        eq(artists.isActive, true),
        followedIds.size > 0
          ? sql`${artists.spotifyId} not in (${sql.join(
              [...followedIds].map((id) => sql`${id}`),
              sql`, `,
            )})`
          : sql`true`,
      ),
    )
    .returning({ id: artists.id });

  return {
    fetched: followed.length,
    added,
    reactivated,
    unfollowed: deactivated.length,
  };
}

export type ImageBackfillResult = { checked: number; found: number; missed: number; error?: string };

/**
 * Fill in artist images from Spotify for anyone missing one, whatever their
 * source. This is a lookup of public artist data, so it does not imply the
 * artist came from the follow list and never changes `source` — that records
 * how the artist got onto the list, and the sync relies on it.
 */
export async function backfillArtistImages(
  user: User,
  limit = 40,
): Promise<ImageBackfillResult> {
  const missing = await db
    .select({ id: artists.id, name: artists.name, aliases: artists.aliases })
    .from(artists)
    .where(and(eq(artists.userId, user.id), isNull(artists.imageUrl)))
    .limit(limit);

  if (missing.length === 0) return { checked: 0, found: 0, missed: 0 };

  let found = 0;
  let firstError: string | undefined;

  const results = await mapWithConcurrency(missing, 4, async (artist) => {
    const match = await findArtistImage(artist.name, artist.aliases);
    if (!match) return false;
    await db
      .update(artists)
      .set({ imageUrl: match.imageUrl })
      .where(eq(artists.id, artist.id));
    return true;
  });

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value) found += 1;
    } else if (!firstError) {
      firstError = errorMessage(result.reason);
    }
  }

  return {
    checked: missing.length,
    found,
    missed: missing.length - found,
    ...(firstError ? { error: firstError } : {}),
  };
}

/**
 * Give suggestions a face. Gemini returns names, so each one is looked up in
 * Spotify's catalogue the same conservative way as artist images: the returned
 * name must match, or the suggestion keeps its monogram.
 */
export async function backfillSuggestionImages(userId: string, limit = 24): Promise<number> {
  const missing = await db
    .select({
      id: artistSuggestions.id,
      name: artistSuggestions.name,
      aliases: artistSuggestions.aliases,
    })
    .from(artistSuggestions)
    .where(and(eq(artistSuggestions.userId, userId), isNull(artistSuggestions.imageUrl)))
    .limit(limit);

  if (missing.length === 0) return 0;

  let found = 0;
  const results = await mapWithConcurrency(missing, 4, async (suggestion) => {
    const match = await findArtistImage(suggestion.name, suggestion.aliases);
    if (!match) return false;
    await db
      .update(artistSuggestions)
      .set({ imageUrl: match.imageUrl })
      .where(eq(artistSuggestions.id, suggestion.id));
    return true;
  });

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) found += 1;
  }
  return found;
}
