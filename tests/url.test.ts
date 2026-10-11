import { describe, expect, it } from 'vitest';
import { canonicaliseUrl, urlHash } from '../lib/url';

describe('canonicaliseUrl', () => {
  it('strips tracking params but keeps meaningful ones', () => {
    expect(
      canonicaliseUrl('https://in.bookmyshow.com/events/x?utm_source=fb&id=42&fbclid=abc'),
    ).toBe('https://in.bookmyshow.com/events/x?id=42');
  });

  it('drops the fragment, www and a trailing slash', () => {
    expect(canonicaliseUrl('https://www.district.in/events/gig/#lineup')).toBe(
      'https://district.in/events/gig',
    );
  });

  it('sorts params so order cannot create a second identity', () => {
    expect(canonicaliseUrl('https://x.com/a?b=2&a=1')).toBe(
      canonicaliseUrl('https://x.com/a?a=1&b=2'),
    );
  });

  it('strips the oc param Google News appends to every link', () => {
    expect(canonicaliseUrl('https://news.google.com/rss/articles/ABC123?oc=5')).toBe(
      'https://news.google.com/rss/articles/ABC123',
    );
  });

  it('lower-cases the host but never the path', () => {
    expect(canonicaliseUrl('https://District.IN/Events/Gig')).toBe(
      'https://district.in/Events/Gig',
    );
  });

  it('keeps an unparseable string instead of dropping the item', () => {
    expect(canonicaliseUrl('  not a url  ')).toBe('not a url');
  });
});

describe('urlHash', () => {
  it('is a sha256 hex digest', () => {
    expect(urlHash('https://example.com/a')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('collapses two spellings of the same article to one key', () => {
    expect(urlHash('https://www.highape.com/bangalore/events/x/?utm_medium=email')).toBe(
      urlHash('https://highape.com/bangalore/events/x#tickets'),
    );
  });

  it('keeps genuinely different URLs apart', () => {
    expect(urlHash('https://example.com/a')).not.toBe(urlHash('https://example.com/b'));
  });
});
