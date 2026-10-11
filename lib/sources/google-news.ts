import { XMLParser } from 'fast-xml-parser';
import { errorMessage, fetchWithRetry } from '@/lib/http';
import type { FetchOutcome, NormalisedItem } from '@/lib/sources/types';

const CITY_CLAUSE =
  'India OR Bengaluru OR Bangalore OR Mumbai OR Delhi OR Chennai OR Hyderabad OR Pune OR Goa OR Kolkata';
const EVENT_CLAUSE = 'concert OR tour OR gig OR tickets OR festival';
const WINDOW = 'when:14d';

/** The exact query shape the spec asks for, one artist (or alias) at a time. */
export function buildGoogleNewsQuery(artistOrAlias: string): string {
  return `"${artistOrAlias}" (${CITY_CLAUSE}) (${EVENT_CLAUSE}) ${WINDOW}`;
}

export function buildGoogleNewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Google News puts the publisher in <source> and repeats the headline inside an
 * HTML <a> in <description>, so the description adds no new text. Keep the
 * publisher name instead — that is the only extra signal in the feed.
 */
function buildSnippet(item: Record<string, unknown>): string | null {
  const source = item.source as { '#text'?: string } | string | undefined;
  const publisher =
    typeof source === 'string' ? source : typeof source === 'object' ? source?.['#text'] : undefined;
  return publisher ? `Published by ${publisher}` : null;
}

export function parseGoogleNewsXml(
  xml: string,
  query: string,
  artistId: string | null,
): NormalisedItem[] {
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: Record<string, unknown> | Record<string, unknown>[] } };
  };

  return asArray(parsed.rss?.channel?.item)
    .map((item): NormalisedItem | null => {
      const link = typeof item.link === 'string' ? item.link : null;
      if (!link) return null;
      return {
        source: 'google_news',
        query,
        url: link,
        title: typeof item.title === 'string' ? item.title : null,
        snippet: buildSnippet(item),
        publishedAt: parseDate(item.pubDate),
        artistId,
      };
    })
    .filter((item): item is NormalisedItem => item !== null);
}

/** Fetch one artist name or alias. Never throws: failures come back as errors. */
export async function fetchGoogleNews(
  artistOrAlias: string,
  artistId: string | null,
  timeoutMs = 10_000,
): Promise<FetchOutcome> {
  const query = buildGoogleNewsQuery(artistOrAlias);

  try {
    const response = await fetchWithRetry(
      buildGoogleNewsUrl(query),
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LiveShowRadar/1.0)' } },
      { timeoutMs, label: `google_news ${artistOrAlias}` },
    );

    if (!response.ok) {
      return {
        items: [],
        errors: [
          {
            source: 'google_news',
            query,
            artist: artistOrAlias,
            message: `HTTP ${response.status}`,
          },
        ],
      };
    }

    return { items: parseGoogleNewsXml(await response.text(), query, artistId), errors: [] };
  } catch (error) {
    return {
      items: [],
      errors: [
        { source: 'google_news', query, artist: artistOrAlias, message: errorMessage(error) },
      ],
    };
  }
}
