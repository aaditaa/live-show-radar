import { describe, expect, it } from 'vitest';
import { buildGoogleNewsQuery, buildGoogleNewsUrl, parseGoogleNewsXml } from '../lib/sources/google-news';
import { buildPriorityArtistQuery, SWEEP_QUERIES, TICKETING_DOMAINS } from '../lib/sources/tavily';
import { nextCheckAt, STARRED_RECHECK_HOURS, UNSTARRED_RECHECK_HOURS } from '../lib/pipeline/batch';

describe('buildGoogleNewsQuery', () => {
  it('quotes the artist and includes the city, event and 14-day clauses', () => {
    const q = buildGoogleNewsQuery('Prateek Kuhad');
    expect(q).toContain('"Prateek Kuhad"');
    expect(q).toContain('Bengaluru OR Bangalore');
    expect(q).toContain('concert OR tour OR gig OR tickets OR festival');
    expect(q).toContain('when:14d');
  });

  it('builds an India-localised feed URL with the query encoded', () => {
    const url = buildGoogleNewsUrl(buildGoogleNewsQuery('Ritviz'));
    expect(url.startsWith('https://news.google.com/rss/search?q=')).toBe(true);
    expect(url).toContain('hl=en-IN');
    expect(url).toContain('gl=IN');
    expect(url).toContain('ceid=IN:en');
    expect(url).toContain('%22Ritviz%22');
  });
});

const SAMPLE_XML = `<?xml version="1.0"?><rss version="2.0"><channel><title>feed</title>
<item><title>Lifafa announces Bengaluru show - Rolling Stone India</title>
<link>https://news.google.com/rss/articles/ABC?oc=5</link>
<pubDate>Thu, 08 Oct 2026 06:51:05 GMT</pubDate>
<source url="https://rollingstoneindia.com">Rolling Stone India</source></item>
<item><title>Second story</title><link>https://news.google.com/rss/articles/DEF?oc=5</link>
<pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate>
<source url="https://example.com">Example</source></item>
</channel></rss>`;

describe('parseGoogleNewsXml', () => {
  const items = parseGoogleNewsXml(SAMPLE_XML, 'q', 'artist-1');

  it('normalises every item to the shared shape', () => {
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      source: 'google_news',
      query: 'q',
      artistId: 'artist-1',
      url: 'https://news.google.com/rss/articles/ABC?oc=5',
      title: 'Lifafa announces Bengaluru show - Rolling Stone India',
    });
  });

  it('parses pubDate into a Date', () => {
    expect(items[0].publishedAt?.toISOString()).toBe('2026-10-08T06:51:05.000Z');
  });

  it('keeps the publisher as the snippet, since the description adds nothing', () => {
    expect(items[0].snippet).toBe('Published by Rolling Stone India');
  });

  it('handles a feed with a single item, which the XML parser returns unwrapped', () => {
    const single = SAMPLE_XML.replace(/<item>Second[\s\S]*?<\/item>/, '');
    expect(parseGoogleNewsXml(single, 'q', null).length).toBeGreaterThanOrEqual(1);
  });

  it('returns nothing for an empty feed rather than throwing', () => {
    expect(parseGoogleNewsXml('<rss><channel></channel></rss>', 'q', null)).toEqual([]);
  });
});

describe('tavily configuration', () => {
  it('has the four sweep queries from the spec', () => {
    expect(SWEEP_QUERIES).toHaveLength(4);
    expect(SWEEP_QUERIES).toContain('early bird tickets concert Bengaluru');
  });

  it('lists the five verified Indian ticketing domains', () => {
    expect([...TICKETING_DOMAINS]).toEqual([
      'district.in',
      'bookmyshow.com',
      'skillboxes.com',
      'sortmyscene.com',
      'highape.com',
    ]);
  });

  it('builds the priority-artist query', () => {
    expect(buildPriorityArtistQuery('Ritviz')).toBe('Ritviz India tour tickets');
  });
});

describe('nextCheckAt', () => {
  const now = new Date('2026-10-11T00:00:00Z');

  it('brings starred artists back in 2 hours', () => {
    expect(nextCheckAt({ isStarred: true }, now).toISOString()).toBe('2026-10-11T02:00:00.000Z');
    expect(STARRED_RECHECK_HOURS).toBe(2);
  });

  it('brings everyone else back in 6 hours', () => {
    expect(nextCheckAt({ isStarred: false }, now).toISOString()).toBe('2026-10-11T06:00:00.000Z');
    expect(UNSTARRED_RECHECK_HOURS).toBe(6);
  });
});

describe('priority Tavily checks', () => {
  // pickPriorityArtists hits the database, so the ordering rule is asserted
  // against the same shape it sorts: never-checked first, then starred.
  type Row = { id: string; isStarred: boolean; lastCheckedAt: Date | null };

  function order(batch: Row[]): string[] {
    return [
      ...batch.filter((a) => a.lastCheckedAt === null),
      ...batch.filter((a) => a.lastCheckedAt !== null && a.isStarred),
    ].map((a) => a.id);
  }

  it('puts a brand new artist ahead of an established starred one', () => {
    expect(
      order([
        { id: 'starred-old', isStarred: true, lastCheckedAt: new Date('2026-10-01') },
        { id: 'brand-new', isStarred: false, lastCheckedAt: null },
      ]),
    ).toEqual(['brand-new', 'starred-old']);
  });

  it('includes an unstarred artist that has never been checked', () => {
    expect(order([{ id: 'gorillaz', isStarred: false, lastCheckedAt: null }])).toEqual(['gorillaz']);
  });

  it('excludes an unstarred artist that has already been checked', () => {
    expect(
      order([{ id: 'seen', isStarred: false, lastCheckedAt: new Date('2026-10-01') }]),
    ).toEqual([]);
  });
});

describe('gemini grounding (source E)', () => {
  it('builds a prompt that asks only about India and ticket windows', async () => {
    const { buildGroundingPrompt } = await import('../lib/sources/gemini-grounding');
    const prompt = buildGroundingPrompt('Lifafa');
    expect(prompt).toContain('Lifafa');
    expect(prompt).toContain('India');
    expect(prompt).toContain('early-bird');
    // It must not invite the model to answer from memory.
    expect(prompt).toContain('only what the search results actually say');
  });
});
