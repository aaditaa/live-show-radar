import { describe, expect, it } from 'vitest';
import {
  buildDedupKey,
  isUpcoming,
  parseEventDate,
  parseTimestamp,
  triageCandidates,
} from '../lib/pipeline/match';
import type { ShowCandidate } from '../lib/ai/schemas';

const NOW = new Date('2026-10-11T00:00:00Z');
const ARTIST = '11111111-1111-1111-1111-111111111111';

function candidate(overrides: Partial<ShowCandidate> = {}): ShowCandidate {
  return {
    artist_name: 'Lifafa',
    artist_match_confidence: 0.95,
    is_show_announcement: true,
    event_name: 'Lifafa Live',
    is_festival: false,
    festival_name: null,
    country: 'India',
    city: 'Bengaluru',
    venue: 'Fandom',
    event_date: '2026-12-05',
    date_precision: 'day',
    ticket_platform: 'District',
    ticket_url: 'https://district.in/x',
    on_sale_at: null,
    early_bird_status: 'open',
    early_bird_opens_at: null,
    early_bird_deadline: null,
    early_bird_note: null,
    evidence: 'Lifafa plays Bengaluru on 5 December',
    source_url: 'https://example.com/a',
    ...overrides,
  };
}

const resolve = (name: string) =>
  ['lifafa', 'suryakant sawhney'].includes(name.toLowerCase()) ? ARTIST : null;

describe('buildDedupKey', () => {
  it('is artist_id|normalised_city|event_date', () => {
    expect(buildDedupKey(ARTIST, 'Bengaluru', '2026-12-05')).toBe(`${ARTIST}|Bengaluru|2026-12-05`);
  });

  it('collapses city spellings so one show is not stored twice', () => {
    expect(buildDedupKey(ARTIST, 'Bangalore', '2026-12-05')).toBe(
      buildDedupKey(ARTIST, 'bengaluru', '2026-12-05'),
    );
    expect(buildDedupKey(ARTIST, 'Bombay', '2026-12-05')).toBe(
      buildDedupKey(ARTIST, 'Mumbai', '2026-12-05'),
    );
  });

  it('marks a missing city or date as unknown rather than empty', () => {
    expect(buildDedupKey(ARTIST, null, null)).toBe(`${ARTIST}|unknown|unknown`);
  });

  it('keeps two dates in one city apart', () => {
    expect(buildDedupKey(ARTIST, 'Bengaluru', '2026-12-05')).not.toBe(
      buildDedupKey(ARTIST, 'Bengaluru', '2026-12-06'),
    );
  });
});

describe('parseEventDate', () => {
  it('accepts a real ISO date', () => {
    expect(parseEventDate('2026-12-05')).toBe('2026-12-05');
    expect(parseEventDate('2026-12-05T20:00:00+05:30')).toBe('2026-12-05');
  });

  it('rejects a date the calendar does not have', () => {
    expect(parseEventDate('2026-02-31')).toBeNull();
  });

  it('rejects prose instead of guessing', () => {
    expect(parseEventDate('December 2026')).toBeNull();
    expect(parseEventDate('TBA')).toBeNull();
    expect(parseEventDate(null)).toBeNull();
  });
});

describe('parseTimestamp', () => {
  it('parses an IST offset correctly', () => {
    expect(parseTimestamp('2026-12-05T20:00:00+05:30')?.toISOString()).toBe(
      '2026-12-05T14:30:00.000Z',
    );
  });

  it('returns null for junk', () => {
    expect(parseTimestamp('soon')).toBeNull();
  });
});

describe('isUpcoming', () => {
  it('keeps today and later', () => {
    expect(isUpcoming('2026-10-11', 'day', NOW)).toBe(true);
    expect(isUpcoming('2026-12-05', 'day', NOW)).toBe(true);
  });

  it('drops yesterday', () => {
    expect(isUpcoming('2026-10-10', 'day', NOW)).toBe(false);
  });

  it('keeps a month-precision date until the month ends', () => {
    expect(isUpcoming('2026-10-01', 'month', NOW)).toBe(true);
    expect(isUpcoming('2026-09-01', 'month', NOW)).toBe(false);
  });
});

describe('triageCandidates', () => {
  it('accepts a clean Indian show', () => {
    const { accepted, rejected } = triageCandidates([candidate()], resolve, NOW);
    expect(rejected).toHaveLength(0);
    expect(accepted[0].city).toBe('Bengaluru');
    expect(accepted[0].dedupKey).toBe(`${ARTIST}|Bengaluru|2026-12-05`);
  });

  it('rejects anything that is not a show announcement', () => {
    const { rejected } = triageCandidates(
      [candidate({ is_show_announcement: false })],
      resolve,
      NOW,
    );
    expect(rejected[0].reason).toBe('not_a_show_announcement');
  });

  it('rejects shows outside India', () => {
    const { rejected } = triageCandidates(
      [candidate({ country: 'United States', city: 'Los Angeles' })],
      resolve,
      NOW,
    );
    expect(rejected[0].reason).toBe('not_india');
  });

  it('rejects a confidence below 0.7', () => {
    const { rejected } = triageCandidates(
      [candidate({ artist_match_confidence: 0.6 })],
      resolve,
      NOW,
    );
    expect(rejected[0].reason).toBe('low_confidence');
  });

  it('rejects a past event', () => {
    const { rejected } = triageCandidates([candidate({ event_date: '2026-01-01' })], resolve, NOW);
    expect(rejected[0].reason).toBe('past_event');
  });

  it('rejects a show with no city, which could not be deduped', () => {
    const { rejected } = triageCandidates([candidate({ city: null })], resolve, NOW);
    expect(rejected[0].reason).toBe('no_city');
  });

  it('rejects an artist we do not follow', () => {
    const { rejected } = triageCandidates([candidate({ artist_name: 'Leon Bridges' })], resolve, NOW);
    expect(rejected[0].reason).toBe('unknown_artist');
  });

  it('resolves an artist by alias', () => {
    const { accepted } = triageCandidates(
      [candidate({ artist_name: 'Suryakant Sawhney' })],
      resolve,
      NOW,
    );
    expect(accepted).toHaveLength(1);
  });

  it('treats the country check as case-insensitive', () => {
    const { accepted } = triageCandidates([candidate({ country: 'india' })], resolve, NOW);
    expect(accepted).toHaveLength(1);
  });
});
