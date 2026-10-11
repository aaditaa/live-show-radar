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

export type EarlyBirdStatus = (typeof EARLY_BIRD_STATUSES)[number];

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

/* ---------- Task 2: reconcile ---------- */

export const MATERIAL_CHANGES = [
  'none',
  'early_bird_opened',
  'early_bird_deadline_set',
  'venue_announced',
  'date_changed',
  'on_sale_announced',
  'sold_out',
  'cancelled',
] as const;

export type MaterialChange = (typeof MATERIAL_CHANGES)[number];

export const reconcileResponseSchema = z.object({
  same_show: z.boolean(),
  changes: z.array(
    z.object({
      field: z.string(),
      old: nullableText,
      new: nullableText,
    }),
  ),
  material_change: z.enum(MATERIAL_CHANGES),
});

export type ReconcileResponse = z.infer<typeof reconcileResponseSchema>;

export const RECONCILE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    same_show: { type: 'boolean' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          old: { type: ['string', 'null'] },
          new: { type: ['string', 'null'] },
        },
        required: ['field', 'old', 'new'],
      },
    },
    material_change: { type: 'string', enum: [...MATERIAL_CHANGES] },
  },
  required: ['same_show', 'changes', 'material_change'],
};

/* ---------- Task 3: prioritise and write the alert ---------- */

export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const;

export const alertResponseSchema = z.object({
  priority: z.enum(PRIORITIES),
  headline: z.string(),
  message: z.string(),
  action_by: nullableText,
  reason: z.string(),
});

export type AlertResponse = z.infer<typeof alertResponseSchema>;

export const ALERT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    priority: { type: 'string', enum: [...PRIORITIES] },
    headline: { type: 'string' },
    message: {
      type: 'string',
      description: 'Telegram HTML, at most 600 characters',
    },
    action_by: { type: ['string', 'null'], description: 'ISO 8601 datetime or null' },
    reason: { type: 'string' },
  },
  required: ['priority', 'headline', 'message', 'action_by', 'reason'],
};

/* ---------- Suggestions: artists similar to the ones already followed ---------- */

export const suggestResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string(),
      aliases: z.array(z.string()),
      similar_to: z.string(),
      reason: z.string(),
    }),
  ),
});

export type SuggestResponse = z.infer<typeof suggestResponseSchema>;

export const SUGGEST_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' } },
          similar_to: { type: 'string', description: 'a followed artist this one resembles' },
          reason: { type: 'string', description: 'one short sentence' },
        },
        required: ['name', 'aliases', 'similar_to', 'reason'],
      },
    },
  },
  required: ['suggestions'],
};
