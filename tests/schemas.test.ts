import { describe, expect, it } from 'vitest';
import {
  EXTRACT_RESPONSE_SCHEMA,
  extractResponseSchema,
  showCandidateSchema,
} from '../lib/ai/schemas';

const VALID = {
  artist_name: 'Lifafa',
  artist_match_confidence: 0.9,
  is_show_announcement: true,
  event_name: 'Lifafa Live',
  is_festival: false,
  festival_name: null,
  country: 'India',
  city: 'Bengaluru',
  venue: null,
  event_date: '2026-12-05',
  date_precision: 'day',
  ticket_platform: null,
  ticket_url: null,
  on_sale_at: null,
  early_bird_status: 'open',
  early_bird_opens_at: null,
  early_bird_deadline: null,
  early_bird_note: null,
  evidence: 'plays Bengaluru on 5 December',
  source_url: 'https://example.com/a',
};

describe('showCandidateSchema', () => {
  it('accepts a well-formed candidate', () => {
    expect(showCandidateSchema.safeParse(VALID).success).toBe(true);
  });

  it('normalises empty strings and the literal "null" to null', () => {
    const parsed = showCandidateSchema.parse({ ...VALID, venue: '', festival_name: 'null' });
    expect(parsed.venue).toBeNull();
    expect(parsed.festival_name).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(showCandidateSchema.parse({ ...VALID, city: '  Bengaluru  ' }).city).toBe('Bengaluru');
  });

  it('rejects a confidence outside 0..1', () => {
    expect(showCandidateSchema.safeParse({ ...VALID, artist_match_confidence: 1.4 }).success).toBe(
      false,
    );
    expect(showCandidateSchema.safeParse({ ...VALID, artist_match_confidence: -0.1 }).success).toBe(
      false,
    );
  });

  it('rejects an early_bird_status outside the enum', () => {
    expect(showCandidateSchema.safeParse({ ...VALID, early_bird_status: 'maybe' }).success).toBe(
      false,
    );
  });

  it('rejects a date_precision outside day and month', () => {
    expect(showCandidateSchema.safeParse({ ...VALID, date_precision: 'year' }).success).toBe(false);
  });

  it('rejects a missing required field', () => {
    const { evidence, ...withoutEvidence } = VALID;
    void evidence;
    expect(showCandidateSchema.safeParse(withoutEvidence).success).toBe(false);
  });

  it('rejects a string where a boolean belongs', () => {
    expect(showCandidateSchema.safeParse({ ...VALID, is_festival: 'yes' }).success).toBe(false);
  });
});

describe('extractResponseSchema', () => {
  it('accepts an empty shows array, which is the common answer', () => {
    expect(extractResponseSchema.parse({ shows: [] })).toEqual({ shows: [] });
  });

  it('rejects a response with no shows key', () => {
    expect(extractResponseSchema.safeParse({}).success).toBe(false);
  });

  it('rejects the whole response when one candidate is malformed', () => {
    expect(
      extractResponseSchema.safeParse({ shows: [VALID, { ...VALID, country: 42 }] }).success,
    ).toBe(false);
  });
});

describe('EXTRACT_RESPONSE_SCHEMA (sent to Gemini)', () => {
  it('requires every field Appendix B lists', () => {
    const items = (
      EXTRACT_RESPONSE_SCHEMA.properties as {
        shows: { items: { required: string[]; properties: Record<string, unknown> } };
      }
    ).shows.items;
    expect(items.required).toHaveLength(20);
    expect(Object.keys(items.properties)).toHaveLength(20);
  });

  it('matches the zod schema field for field, so drift cannot creep in', () => {
    const jsonFields = Object.keys(
      (
        EXTRACT_RESPONSE_SCHEMA.properties as {
          shows: { items: { properties: Record<string, unknown> } };
        }
      ).shows.items.properties,
    ).sort();
    const zodFields = Object.keys(showCandidateSchema.shape).sort();
    expect(jsonFields).toEqual(zodFields);
  });
});
