import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { artists, users } from '@/db/schema';
import { db } from '@/lib/db';
import { hasAdminSession } from '@/lib/auth';
import { errorMessage } from '@/lib/http';
import { searchArtists } from '@/lib/spotify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Type-ahead for the artist picker. Admin only, since it spends an API call. */
export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get('q') ?? '';
  if (query.trim().length < 2) return NextResponse.json({ results: [] });

  try {
    const [results, user] = await Promise.all([
      searchArtists(query),
      db.select().from(users).limit(1),
    ]);

    // Mark the ones already on the list so the picker can say so.
    const existing = user[0]
      ? await db
          .select({ name: artists.name, spotifyId: artists.spotifyId })
          .from(artists)
          .where(eq(artists.userId, user[0].id))
      : [];

    const byName = new Set(existing.map((a) => a.name.toLowerCase()));
    const byId = new Set(existing.map((a) => a.spotifyId).filter(Boolean));

    return NextResponse.json({
      results: results.map((result) => ({
        ...result,
        alreadyAdded: byName.has(result.name.toLowerCase()) || byId.has(result.spotifyId),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 });
  }
}
