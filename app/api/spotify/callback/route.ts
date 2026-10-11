import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { users } from '@/db/schema';
import { db } from '@/lib/db';
import {
  SPOTIFY_STATE_COOKIE,
  exchangeCodeForTokens,
  getCurrentUserId,
  hashState,
  storeTokens,
} from '@/lib/spotify';
import { describeSpotifyError } from '@/lib/spotify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function back(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, process.env.APP_URL ?? 'http://127.0.0.1:3000'));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return back(`/artists?error=${encodeURIComponent(error)}`);
  if (!code || !state) return back('/artists?error=missing_code');

  // The state cookie is the CSRF guard: a callback we did not initiate fails here.
  const store = await cookies();
  const expected = store.get(SPOTIFY_STATE_COOKIE)?.value;
  store.delete(SPOTIFY_STATE_COOKIE);
  if (!expected || expected !== hashState(state)) {
    return back('/artists?error=state_mismatch');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const spotifyUserId = (await getCurrentUserId(tokens.access_token)) ?? undefined;

    const user = (await db.select().from(users).limit(1))[0];
    if (!user) return back('/artists?error=no_user');

    await storeTokens(user.id, tokens, spotifyUserId);
    return back('/artists?connected=1');
  } catch (caught) {
    return back(`/artists?error=${encodeURIComponent(describeSpotifyError(caught))}`);
  }
}
