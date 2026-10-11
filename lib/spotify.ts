import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { users, type User } from '@/db/schema';
import { db } from '@/lib/db';
import { optionalEnv, requireEnv } from '@/lib/env';
import { errorMessage, fetchWithRetry } from '@/lib/http';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

/** The only scope this app needs: read who the user follows. */
export const SPOTIFY_SCOPE = 'user-follow-read';

export const SPOTIFY_STATE_COOKIE = 'lsr_spotify_state';

export function isSpotifyConfigured(): boolean {
  return Boolean(
    optionalEnv('SPOTIFY_CLIENT_ID') &&
      optionalEnv('SPOTIFY_CLIENT_SECRET') &&
      optionalEnv('SPOTIFY_REDIRECT_URI'),
  );
}

export function createOAuthState(): string {
  return randomBytes(16).toString('hex');
}

/** The state cookie holds a hash, so reading the cookie reveals nothing useful. */
export function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('SPOTIFY_CLIENT_ID'),
    response_type: 'code',
    redirect_uri: requireEnv('SPOTIFY_REDIRECT_URI'),
    scope: SPOTIFY_SCOPE,
    state,
    show_dialog: 'false',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function basicAuthHeader(): string {
  const id = requireEnv('SPOTIFY_CLIENT_ID');
  const secret = requireEnv('SPOTIFY_CLIENT_SECRET');
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const response = await fetchWithRetry(
    TOKEN_URL,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: requireEnv('SPOTIFY_REDIRECT_URI'),
      }).toString(),
    },
    { timeoutMs: 10_000, label: 'spotify token exchange' },
  );

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error_description ?? body.error ?? `HTTP ${response.status}`);
  }
  return body as TokenResponse;
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const response = await fetchWithRetry(
    TOKEN_URL,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    },
    { timeoutMs: 10_000, label: 'spotify token refresh' },
  );

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error_description ?? body.error ?? `HTTP ${response.status}`);
  }
  return body as TokenResponse;
}

export async function storeTokens(
  userId: string,
  tokens: TokenResponse,
  spotifyUserId?: string,
): Promise<void> {
  await db
    .update(users)
    .set({
      spotifyAccessToken: tokens.access_token,
      // Spotify only returns a new refresh token sometimes; keep the old one otherwise.
      ...(tokens.refresh_token ? { spotifyRefreshToken: tokens.refresh_token } : {}),
      spotifyTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      ...(spotifyUserId ? { spotifyUserId } : {}),
    })
    .where(eq(users.id, userId));
}

/**
 * A usable access token, refreshed when it is within a minute of expiring.
 * Tokens never leave the server.
 */
export async function getAccessToken(user: User): Promise<string | null> {
  if (!user.spotifyAccessToken && !user.spotifyRefreshToken) return null;

  const expiresAt = user.spotifyTokenExpiresAt?.getTime() ?? 0;
  if (user.spotifyAccessToken && expiresAt - 60_000 > Date.now()) {
    return user.spotifyAccessToken;
  }

  if (!user.spotifyRefreshToken) return null;

  const refreshed = await refreshTokens(user.spotifyRefreshToken);
  await storeTokens(user.id, refreshed);
  return refreshed.access_token;
}

export type SpotifyArtist = { id: string; name: string; imageUrl: string | null };

/**
 * App-level token, no user involved. Used for artist lookups, which need no
 * user scope — an artist's public image is the same for everyone.
 */
let appToken: { value: string; expiresAt: number } | undefined;

export async function getAppToken(): Promise<string> {
  if (appToken && appToken.expiresAt - 60_000 > Date.now()) return appToken.value;

  const response = await fetchWithRetry(
    TOKEN_URL,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    },
    { timeoutMs: 10_000, label: 'spotify app token' },
  );

  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description ?? body.error ?? `HTTP ${response.status}`);

  appToken = {
    value: body.access_token as string,
    expiresAt: Date.now() + (body.expires_in as number) * 1000,
  };
  return appToken.value;
}

/** Compare names ignoring case, punctuation, accents and a leading "the". */
function nameKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Find an artist's image by name.
 *
 * Search is fuzzy, so the result is only accepted when the returned name
 * matches the one we asked for. Putting the wrong face on an artist is worse
 * than showing no face at all — "Eagles" and "Queen" both have near-misses.
 */
export async function findArtistImage(
  name: string,
  aliases: readonly string[] = [],
): Promise<{ imageUrl: string; spotifyName: string } | null> {
  const token = await getAppToken();
  const response = await fetchWithRetry(
    `${API}/search?q=${encodeURIComponent(name)}&type=artist&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } },
    { timeoutMs: 10_000, label: `spotify search ${name}` },
  );

  if (!response.ok) {
    throw new Error(`Spotify search failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    artists?: { items?: { name: string; images?: { url: string }[] }[] };
  };

  const acceptable = new Set([nameKey(name), ...aliases.map(nameKey)]);

  for (const item of body.artists?.items ?? []) {
    if (!acceptable.has(nameKey(item.name))) continue;
    const imageUrl = item.images?.[0]?.url;
    if (imageUrl) return { imageUrl, spotifyName: item.name };
  }

  return null;
}

type FollowingResponse = {
  artists: {
    items: { id: string; name: string; images?: { url: string }[] }[];
    next: string | null;
    cursors?: { after: string | null };
  };
};

export async function getCurrentUserId(accessToken: string): Promise<string | null> {
  const response = await fetchWithRetry(
    `${API}/me`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { timeoutMs: 10_000, label: 'spotify me' },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { id?: string };
  return body.id ?? null;
}

/**
 * Every followed artist, paginated with the `after` cursor.
 *
 * The app is in Development Mode, so this deliberately reads only `id`, `name`
 * and `images` — `followers` and `popularity` are no longer returned, and the
 * batch `GET /artists` endpoint is unavailable.
 */
export async function getFollowedArtists(accessToken: string): Promise<SpotifyArtist[]> {
  const collected: SpotifyArtist[] = [];
  let url: string | null = `${API}/me/following?type=artist&limit=50`;

  // Hard stop so a malformed cursor can never loop forever.
  for (let page = 0; url && page < 40; page += 1) {
    const response: Response = await fetchWithRetry(
      url,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      { timeoutMs: 10_000, label: 'spotify following' },
    );

    if (!response.ok) {
      // Report what Spotify said. A 403 has several causes — the app owner
      // lacking Premium, the account not being on the Development Mode
      // allowlist, or a missing scope — and guessing between them sends
      // people to fix the wrong thing.
      const detail = (await response.text()).trim();
      const hint =
        response.status === 403
          ? ' A 403 here usually means the app owner has no active Spotify Premium subscription, or this account is not on the app allowlist (Dashboard, User Management).'
          : '';
      throw new Error(
        `Spotify /me/following failed with HTTP ${response.status}. ${detail.slice(0, 220)}${hint}`,
      );
    }

    const body = (await response.json()) as FollowingResponse;

    for (const item of body.artists.items ?? []) {
      collected.push({
        id: item.id,
        name: item.name,
        imageUrl: item.images?.[0]?.url ?? null,
      });
    }

    const after = body.artists.cursors?.after ?? null;
    url = body.artists.next ?? (after ? `${API}/me/following?type=artist&limit=50&after=${after}` : null);
  }

  return collected;
}

export type ArtistSearchResult = {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  followers: number | null;
};

/** Free-text artist search, for picking someone to watch. App-level auth. */
export async function searchArtists(
  query: string,
  limit = 8,
): Promise<ArtistSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const token = await getAppToken();
  const response = await fetchWithRetry(
    `${API}/search?q=${encodeURIComponent(trimmed)}&type=artist&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
    { timeoutMs: 10_000, label: `spotify search ${trimmed}` },
  );

  if (!response.ok) throw new Error(`Spotify search failed with HTTP ${response.status}`);

  const body = (await response.json()) as {
    artists?: {
      items?: {
        id: string;
        name: string;
        images?: { url: string }[];
        genres?: string[];
        followers?: { total?: number };
      }[];
    };
  };

  return (body.artists?.items ?? []).map((item) => ({
    spotifyId: item.id,
    name: item.name,
    imageUrl: item.images?.[item.images.length - 1]?.url ?? null,
    genres: item.genres ?? [],
    followers: item.followers?.total ?? null,
  }));
}

export function describeSpotifyError(error: unknown): string {
  return errorMessage(error);
}
