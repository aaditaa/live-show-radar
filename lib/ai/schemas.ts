import { z } from 'zod';

/** Gemini sometimes returns "" where it means "unknown". Treat both as null. */
const nullableText = z
  .string()
  .nullable()
  .transform((value) => {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 || trimmed.toLowerCase() === 'null' ? null : trimmed;
  });

export const EARLY_BIRD_STATUSES = [
  'open',
  'imminent',
  'sold_out',
  'closed',
  'not_mentioned',
] as const;

export const showCandidateSchema = z.object({
  artist_name: z.string(),
  artist_match_confidence: z.number().min(0).max(1),
  is_show_announcement: z.boolean(),
  event_name: nullableText,
  is_festival: z.boolean(),
  festival_name: nullableText,
  country: z.string(),
  city: nullableText,
  venue: nullableText,
  event_date: nullableText,
  date_precision: z.enum(['day', 'month']),
  ticket_platform: nullableText,
  ticket_url: nullableText,
  on_sale_at: nullableText,
  early_bird_status: z.enum(EARLY_BIRD_STATUSES),
  early_bird_opens_at: nullableText,
  early_bird_deadline: nullableText,
  early_bird_note: nullableText,
  evidence: z.string(),
  source_url: z.string(),
});

export type ShowCandidate = z.infer<typeof showCandidateSchema>;

export const extractResponseSchema = z.object({
  shows: z.array(showCandidateSchema),
});

export type ExtractResponse = z.infer<typeof extractResponseSchema>;

/**
 * Appendix B, sent to Gemini as `responseSchema`. The SDK accepts the
 * ["string","null"] type arrays as written, so they are kept verbatim.
 */
export const EXTRACT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    shows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          artist_name: { type: 'string' },
          artist_match_confidence: { type: 'number', minimum: 0, maximum: 1 },
          is_show_announcement: { type: 'boolean' },
          event_name: { type: ['string', 'null'] },
          is_festival: { type: 'boolean' },
          festival_name: { type: ['string', 'null'] },
          country: { type: 'string' },
          city: { type: ['string', 'null'] },
          venue: { type: ['string', 'null'] },
          event_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
          date_precision: { type: 'string', enum: ['day', 'month'] },
          ticket_platform: { type: ['string', 'null'] },
          ticket_url: { type: ['string', 'null'] },
          on_sale_at: { type: ['string', 'null'], description: 'ISO 8601 with +05:30' },
          early_bird_status: {
            type: 'string',
            enum: ['open', 'imminent', 'sold_out', 'closed', 'not_mentioned'],
          },
          early_bird_opens_at: { type: ['string', 'null'] },
          early_bird_deadline: { type: ['string', 'null'] },
          early_bird_note: { type: ['string', 'null'] },
          evidence: { type: 'string', description: 'short quote from the item' },
          source_url: { type: 'string' },
        },
        required: [
          'artist_name',
          'artist_match_confidence',
          'is_show_announcement',
          'event_name',
          'is_festival',
          'festival_name',
          'country',
          'city',
          'venue',
          'event_date',
          'date_precision',
          'ticket_platform',
          'ticket_url',
          'on_sale_at',
          'early_bird_status',
          'early_bird_opens_at',
          'early_bird_deadline',
          'early_bird_note',
          'evidence',
          'source_url',
        ],
      },
    },
  },
  required: ['shows'],
};
