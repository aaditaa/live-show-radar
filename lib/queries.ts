import { and, asc, desc, eq, gte, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { artists, scanRuns, shows, users } from '@/db/schema';
import { HOME_CITY } from '@/lib/cities';

export type ShowWithArtist = {
  show: typeof shows.$inferSelect;
  artistName: string;
  artistStarred: boolean;
};

export async function getUser() {
  const rows = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
  return rows[0] ?? null;
}

/** Upcoming shows only: an event today or later, or one with no date yet. */
export async function getUpcomingShows(filters?: {
  city?: string;
  priority?: string;
}): Promise<ShowWithArtist[]> {
  const today = new Date().toISOString().slice(0, 10);

  const conditions = [
    or(isNull(shows.eventDate), gte(shows.eventDate, today)),
  ];
  if (filters?.city) conditions.push(eq(shows.city, filters.city));
  if (filters?.priority) conditions.push(eq(shows.priority, filters.priority));

  const rows = await db
    .select({
      show: shows,
      artistName: artists.name,
      artistStarred: artists.isStarred,
    })
    .from(shows)
    .innerJoin(artists, eq(shows.artistId, artists.id))
    .where(and(...conditions))
    .orderBy(asc(shows.priority), asc(shows.eventDate), desc(shows.firstSeenAt));

  return rows;
}

export function splitByCity(rows: ShowWithArtist[]) {
  return {
    home: rows.filter((r) => r.show.city === HOME_CITY),
    elsewhere: rows.filter((r) => r.show.city !== HOME_CITY),
  };
}

export async function getLastScan() {
  const rows = await db
    .select()
    .from(scanRuns)
    .orderBy(desc(scanRuns.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** The next scan is whichever artist is due soonest; GitHub Actions polls every 30 min. */
export async function getNextCheckAt() {
  const rows = await db
    .select({ nextCheckAt: artists.nextCheckAt })
    .from(artists)
    .where(eq(artists.isActive, true))
    .orderBy(asc(artists.nextCheckAt))
    .limit(1);
  return rows[0]?.nextCheckAt ?? null;
}

export async function getArtistStats() {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      starred: sql<number>`count(*) filter (where ${artists.isStarred})::int`,
      active: sql<number>`count(*) filter (where ${artists.isActive})::int`,
    })
    .from(artists);
  return rows[0] ?? { total: 0, starred: 0, active: 0 };
}

export async function getDistinctCities() {
  const rows = await db
    .selectDistinct({ city: shows.city })
    .from(shows)
    .orderBy(asc(shows.city));
  return rows.map((r) => r.city);
}
