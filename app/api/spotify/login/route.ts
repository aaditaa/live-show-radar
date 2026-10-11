import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/auth';
import {
  SPOTIFY_STATE_COOKIE,
  buildAuthorizeUrl,
  createOAuthState,
  hashState,
  isSpotifyConfigured,
} from '@/lib/spotify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.redirect(new URL('/artists?error=admin_required', process.env.APP_URL));
  }
  if (!isSpotifyConfigured()) {
    return NextResponse.redirect(new URL('/artists?error=spotify_not_configured', process.env.APP_URL));
  }

  const state = createOAuthState();
  const store = await cookies();
  store.set(SPOTIFY_STATE_COOKIE, hashState(state), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
