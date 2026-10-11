import { inArray } from 'drizzle-orm';
import { shows, type Show } from '@/db/schema';
import { db } from '@/lib/db';
import { normaliseCity } from '@/lib/cities';
import { computePriority, KEEP_CONFIDENCE_MIN } from '@/lib/pipeline/priority';
import type { ShowCandidate } from '@/lib/ai/schemas';

/** `artist_id|normalised_city|event_date` — one row per artist, city and date. */
export function buildDedupKey(
  artistId: string,
  city: string | null,
  eventDate: string | null,
): string {
  return `${artistId}|${normaliseCity(city) ?? 'unknown'}|${eventDate ?? 'unknown'}`;
}

/** Accepts only a real YYYY-MM-DD; anything else becomes null rather than a guess. */
export function parseEventDate(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject a date the calendar rolled over, e.g. 2026-02-31.
  if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null;
  return `${year}-${month}-${day}`;
}

export function parseTimestamp(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** A day-precision date is upcoming if it is today or later; a month-precision one until month end. */
export function isUpcoming(
  eventDate: string | null,
  precision: 'day' | 'month',
  now: Date = new Date(),
): boolean {
  // No date at all: Task 1 is told to drop dateless rumours, so trust what it kept.
  if (!eventDate) return true;

  const today = now.toISOString().slice(0, 10);
  if (precision === 'day') return eventDate >= today;

  const [year, month] = eventDate.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return monthEnd >= today;
}

export type AcceptedCandidate = {
  candidate: ShowCandidate;
  artistId: string;
  dedupKey: string;
  city: string;
  eventDate: string | null;
};

export type RejectionReason =
  | 'not_a_show_announcement'
  | 'not_india'
  | 'low_confidence'
  | 'past_event'
  | 'no_city'
  | 'unknown_artist';

export type TriageResult = {
  accepted: AcceptedCandidate[];
  rejected: { candidate: ShowCandidate; reason: RejectionReason }[];
};

/**
 * The spec's keep rules: a real show announcement, in India, confidently
 * matched to a followed artist, dated today or later.
 */
export function triageCandidates(
  candidates: readonly ShowCandidate[],
  resolveArtistId: (artistName: string) => string | null,
  now: Date = new Date(),
): TriageResult {
  const accepted: AcceptedCandidate[] = [];
  const rejected: TriageResult['rejected'] = [];

  for (const candidate of candidates) {
    if (!candidate.is_show_announcement) {
      rejected.push({ candidate, reason: 'not_a_show_announcement' });
      continue;
    }
    if (candidate.country.trim().toLowerCase() !== 'india') {
      rejected.push({ candidate, reason: 'not_india' });
      continue;
    }
    if (candidate.artist_match_confidence < KEEP_CONFIDENCE_MIN) {
      rejected.push({ candidate, reason: 'low_confidence' });
      continue;
    }

    const eventDate = parseEventDate(candidate.event_date);
    if (!isUpcoming(eventDate, candidate.date_precision, now)) {
      rejected.push({ candidate, reason: 'past_event' });
      continue;
    }

    const city = normaliseCity(candidate.city);
    if (!city) {
      // `shows.city` is NOT NULL, and a show with no city cannot be deduped.
      rejected.push({ candidate, reason: 'no_city' });
      continue;
    }

    const artistId = resolveArtistId(candidate.artist_name);
    if (!artistId) {
      rejected.push({ candidate, reason: 'unknown_artist' });
      continue;
    }

    accepted.push({
      candidate,
      artistId,
      city,
      eventDate,
      dedupKey: buildDedupKey(artistId, city, eventDate),
    });
  }

  return { accepted, rejected };
}

export function toShowInsert(accepted: AcceptedCandidate, now: Date = new Date()) {
  const { candidate } = accepted;
  const earlyBirdDeadline = parseTimestamp(candidate.early_bird_deadline);

  return {
    artistId: accepted.artistId,
    dedupKey: accepted.dedupKey,
    eventName: candidate.event_name,
    isFestival: candidate.is_festival,
    festivalName: candidate.festival_name,
    city: accepted.city,
    venue: candidate.venue,
    eventDate: accepted.eventDate,
    datePrecision: candidate.date_precision,
    ticketPlatform: candidate.ticket_platform,
    ticketUrl: candidate.ticket_url,
    onSaleAt: parseTimestamp(candidate.on_sale_at),
    earlyBirdStatus: candidate.early_bird_status,
    earlyBirdOpensAt: parseTimestamp(candidate.early_bird_opens_at),
    earlyBirdDeadline,
    earlyBirdNote: candidate.early_bird_note,
    priority: computePriority(
      {
        city: accepted.city,
        confidence: candidate.artist_match_confidence,
        earlyBirdStatus: candidate.early_bird_status,
        earlyBirdDeadline,
      },
      now,
    ),
    confidence: candidate.artist_match_confidence,
    evidence: candidate.evidence,
    sourceUrls: [candidate.source_url],
  };
}

export async function findExistingShows(dedupKeys: readonly string[]): Promise<Map<string, Show>> {
  if (dedupKeys.length === 0) return new Map();
  const rows = await db.select().from(shows).where(inArray(shows.dedupKey, [...dedupKeys]));
  return new Map(rows.map((row) => [row.dedupKey, row]));
}

/**
 * Insert candidates that have no existing show. Conflicts are left alone here —
 * reconciling a changed show is Gemini Task 2 in the next milestone.
 */
export async function insertNewShows(
  accepted: readonly AcceptedCandidate[],
  now: Date = new Date(),
): Promise<Show[]> {
  if (accepted.length === 0) return [];

  // Collapse duplicates inside this batch so one insert cannot conflict with itself.
  const byKey = new Map<string, AcceptedCandidate>();
  for (const item of accepted) {
    if (!byKey.has(item.dedupKey)) byKey.set(item.dedupKey, item);
  }

  return db
    .insert(shows)
    .values([...byKey.values()].map((item) => toShowInsert(item, now)))
    .onConflictDoNothing({ target: shows.dedupKey })
    .returning();
}
