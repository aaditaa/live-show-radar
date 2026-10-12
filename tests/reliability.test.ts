import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry, mapWithConcurrency } from '../lib/http';
import { fetchGoogleNews } from '../lib/sources/google-news';
import { searchTavily } from '../lib/sources/tavily';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function respond(status: number, body = '', headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe('mapWithConcurrency: one failure must not take down the batch', () => {
  it('returns a settled result per task instead of rejecting', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('source down');
      return n * 10;
    });

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(results[0]).toMatchObject({ value: 10 });
    expect(results[2]).toMatchObject({ value: 30 });
  });

  it('keeps going after a failure rather than stopping at it', async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5], 1, async (n) => {
      seen.push(n);
      if (n <= 3) throw new Error('down');
      return n;
    });
    // Every task ran, including the ones queued behind three failures.
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 5, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(5);
  });

  it('handles an empty batch without spawning workers', async () => {
    expect(await mapWithConcurrency([], 5, async () => 1)).toEqual([]);
  });
});

describe('fetchWithRetry: back off on 429, give up on a client error', () => {
  it('retries a 429 and honours Retry-After', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls.push('call');
      return calls.length === 1
        ? respond(429, 'slow down', { 'retry-after': '0' })
        : respond(200, 'ok');
    }));

    const res = await fetchWithRetry('https://example.com', {}, { retries: 2 });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it('retries a 500', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce(respond(500))
      .mockResolvedValueOnce(respond(200, 'ok'));
    vi.stubGlobal('fetch', fn);

    expect((await fetchWithRetry('https://example.com', {}, { retries: 2 })).status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 400 — a bad request will not fix itself', async () => {
    const fn = vi.fn(async () => respond(400, 'bad key'));
    vi.stubGlobal('fetch', fn);

    expect((await fetchWithRetry('https://example.com', {}, { retries: 3 })).status).toBe(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws once the retries are exhausted, rather than hanging', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(429, '', { 'retry-after': '0' })));
    await expect(fetchWithRetry('https://example.com', {}, { retries: 1 })).rejects.toThrow(/429/);
  });
});

describe('a source that fails reports an error instead of throwing', () => {
  it('Google News returns the failure as data when the feed errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(503, 'unavailable')));

    const outcome = await fetchGoogleNews('Lifafa', 'artist-1');
    expect(outcome.items).toEqual([]);
    expect(outcome.errors[0]).toMatchObject({ source: 'google_news', artist: 'Lifafa' });
  });

  it('Google News survives a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network down');
    }));

    const outcome = await fetchGoogleNews('Ritviz', null);
    expect(outcome.items).toEqual([]);
    expect(outcome.errors).toHaveLength(1);
  });

  it('Google News survives malformed XML rather than crashing the scan', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(200, '<rss><channel><item>')));
    const outcome = await fetchGoogleNews('Lifafa', null);
    expect(outcome.errors).toHaveLength(0);
    expect(Array.isArray(outcome.items)).toBe(true);
  });

  it('Tavily reports a missing key instead of throwing', async () => {
    vi.stubEnv('TAVILY_API_KEY', '');
    const outcome = await searchTavily('anything');
    expect(outcome.items).toEqual([]);
    expect(outcome.errors[0].message).toMatch(/TAVILY_API_KEY/);
  });

  it('Tavily reports an HTTP failure as an error, not an exception', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => respond(401, 'bad key')));

    const outcome = await searchTavily('concert tickets');
    expect(outcome.items).toEqual([]);
    expect(outcome.errors[0]).toMatchObject({ source: 'tavily' });
  });
});
