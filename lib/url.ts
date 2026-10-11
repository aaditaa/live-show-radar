import { createHash } from 'node:crypto';

/** Query params that identify a campaign, not a document. */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^gbraid$/i,
  /^wbraid$/i,
  /^msclkid$/i,
  /^igshid$/i,
  /^mc_(cid|eid)$/i,
  /^ref$/i,
  /^referrer$/i,
  /^source$/i,
  /^oc$/i, // Google News appends oc=5 to every article link
];

/**
 * Canonical form of a URL, so the same article found twice hashes once:
 * lower-cased host without `www.`, no fragment, no tracking params, params
 * sorted, no trailing slash.
 */
export function canonicaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Not parseable — hash the raw string rather than dropping the item.
    return trimmed;
  }

  url.hash = '';
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) url.searchParams.delete(key);
  }
  url.searchParams.sort();

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  const query = url.searchParams.toString();
  return `${url.protocol}//${url.host}${url.pathname}${query ? `?${query}` : ''}`;
}

/** The unique key for `source_items`: sha256 of the canonical URL. */
export function urlHash(raw: string): string {
  return createHash('sha256').update(canonicaliseUrl(raw)).digest('hex');
}
