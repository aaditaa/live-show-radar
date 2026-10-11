import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAuthorizeUrl, hashState, SPOTIFY_SCOPE } from '../lib/spotify';

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
  process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
  process.env.SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3000/api/spotify/callback';
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('buildAuthorizeUrl', () => {
  it('uses the authorization code flow with only the follow-read scope', () => {
    const url = new URL(buildAuthorizeUrl('abc123'));
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('user-follow-read');
    expect(SPOTIFY_SCOPE).toBe('user-follow-read');
  });

  it('sends the state and the exact registered redirect URI', () => {
    const url = new URL(buildAuthorizeUrl('abc123'));
    expect(url.searchParams.get('state')).toBe('abc123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://127.0.0.1:3000/api/spotify/callback',
    );
  });

  it('never puts the client secret in the browser-visible URL', () => {
    expect(buildAuthorizeUrl('abc123')).not.toContain('test-client-secret');
  });
});

describe('hashState', () => {
  it('stores a hash, so the cookie never reveals the state', () => {
    expect(hashState('abc123')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashState('abc123')).not.toBe('abc123');
  });

  it('is deterministic, so the callback can verify it', () => {
    expect(hashState('abc123')).toBe(hashState('abc123'));
    expect(hashState('abc123')).not.toBe(hashState('abc124'));
  });
});
