import { describe, expect, it } from 'vitest';
import { dedupeWithinBatch, isWithinAgeWindow } from '../lib/pipeline/filter';
import type { NormalisedItem } from '../lib/sources/types';

const NOW = new Date('2026-10-11T00:00:00Z');

function item(overrides: Partial<NormalisedItem> = {}): NormalisedItem {
  return {
    source: 'google_news',
    query: 'q',
    url: 'https://example.com/a',
    title: 'A show',
    snippet: null,
    publishedAt: new Date('2026-10-10T00:00:00Z'),
    artistId: null,
    ...overrides,
  };
}

describe('isWithinAgeWindow', () => {
  it('keeps a recent item', () => {
    expect(isWithinAgeWindow(item(), NOW)).toBe(true);
  });

  it('drops an item older than 30 days', () => {
    expect(isWithinAgeWindow(item({ publishedAt: new Date('2026-09-01T00:00:00Z') }), NOW)).toBe(
      false,
    );
  });

  it('keeps an item with no publish date, which Tavily often omits', () => {
    expect(isWithinAgeWindow(item({ publishedAt: null }), NOW)).toBe(true);
  });

  it('treats exactly 30 days as still inside the window', () => {
    expect(isWithinAgeWindow(item({ publishedAt: new Date('2026-09-11T00:00:00Z') }), NOW)).toBe(
      true,
    );
  });
});

describe('dedupeWithinBatch', () => {
  it('collapses the same article found by two sources', () => {
    const kept = dedupeWithinBatch(
      [
        item({ url: 'https://example.com/a?utm_source=x' }),
        item({ source: 'tavily', url: 'https://www.example.com/a/' }),
      ],
      NOW,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].source).toBe('google_news');
  });

  it('drops stale items before hashing', () => {
    const kept = dedupeWithinBatch(
      [item({ publishedAt: new Date('2026-01-01T00:00:00Z') }), item()],
      NOW,
    );
    expect(kept).toHaveLength(1);
  });

  it('attaches a hash to everything it keeps', () => {
    const kept = dedupeWithinBatch([item()], NOW);
    expect(kept[0].urlHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps distinct articles', () => {
    const kept = dedupeWithinBatch(
      [item({ url: 'https://example.com/a' }), item({ url: 'https://example.com/b' })],
      NOW,
    );
    expect(kept).toHaveLength(2);
  });
});
