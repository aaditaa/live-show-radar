import { errorMessage, fetchWithRetry } from '@/lib/http';
import { optionalEnv } from '@/lib/env';
import type { FetchOutcome, NormalisedItem } from '@/lib/sources/types';

const ENDPOINT = 'https://api.tavily.com/search';

/**
 * Indian ticketing platforms, each verified to return indexed results through
 * Tavily before being included here.
 */
export const TICKETING_DOMAINS = [
  'district.in',
  'bookmyshow.com',
  'skillboxes.com',
  'sortmyscene.com',
  'highape.com',
] as const;

/** Broad sweep queries — run at most once every 6 hours. */
export const SWEEP_QUERIES = [
  'new concert announced Bengaluru tickets',
  'international artist India tour tickets',
  'early bird tickets concert Bengaluru',
  'music festival India lineup announced',
] as const;

/**
 * Free tier is 1,000 credits a month and one basic search costs one credit.
 * These caps keep the monthly burn near 790, with headroom. Raise them only
 * with a paid plan.
 */
export const MAX_PRIORITY_ARTISTS_PER_DAY = 10;
export const SWEEP_MIN_GAP_HOURS = 6;
export const PRIORITY_CHECK_MIN_GAP_HOURS = 24;

export function buildPriorityArtistQuery(artistName: string): string {
  return `${artistName} India tour tickets`;
}

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** One Tavily search. Never throws: failures come back as errors. */
export async function searchTavily(
  query: string,
  options: {
    artistId?: string | null;
    includeDomains?: readonly string[];
    maxResults?: number;
    timeRange?: 'day' | 'week' | 'month' | 'year';
    timeoutMs?: number;
  } = {},
): Promise<FetchOutcome> {
  const apiKey = optionalEnv('TAVILY_API_KEY');
  if (!apiKey) {
    return {
      items: [],
      errors: [{ source: 'tavily', query, message: 'TAVILY_API_KEY is not set' }],
    };
  }

  const {
    artistId = null,
    includeDomains,
    maxResults = 5,
    timeRange = 'week',
    timeoutMs = 10_000,
  } = options;

  try {
    const response = await fetchWithRetry(
      ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          max_results: maxResults,
          include_answer: false,
          time_range: timeRange,
          country: 'india',
          ...(includeDomains?.length ? { include_domains: [...includeDomains] } : {}),
        }),
      },
      { timeoutMs, label: `tavily ${query}` },
    );

    if (!response.ok) {
      return {
        items: [],
        errors: [{ source: 'tavily', query, message: `HTTP ${response.status}` }],
      };
    }

    const body = (await response.json()) as { results?: TavilyResult[] };

    const items = (body.results ?? [])
      .filter((result): result is TavilyResult & { url: string } => Boolean(result.url))
      .map(
        (result): NormalisedItem => ({
          source: 'tavily',
          query,
          url: result.url,
          title: result.title ?? null,
          snippet: result.content ?? null,
          publishedAt: parseDate(result.published_date),
          artistId,
        }),
      );

    return { items, errors: [] };
  } catch (error) {
    return { items: [], errors: [{ source: 'tavily', query, message: errorMessage(error) }] };
  }
}
