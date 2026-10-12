import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** All timestamps are timestamptz and stored in UTC. Display happens in Asia/Kolkata. */
const tz = { withTimezone: true } as const;

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  homeCity: text('home_city').notNull().default('Bengaluru'),
  telegramChatId: text('telegram_chat_id'),
  email: text('email'),
  spotifyUserId: text('spotify_user_id'),
  // Server-side only. Never serialise these to the browser.
  spotifyAccessToken: text('spotify_access_token'),
  spotifyRefreshToken: text('spotify_refresh_token'),
  spotifyTokenExpiresAt: timestamp('spotify_token_expires_at', tz),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
});

export const artists = pgTable(
  'artists',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
    spotifyId: text('spotify_id'),
    imageUrl: text('image_url'),
    source: text('source').notNull(),
    isStarred: boolean('is_starred').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    lastCheckedAt: timestamp('last_checked_at', tz),
    nextCheckAt: timestamp('next_check_at', tz).notNull().defaultNow(),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  },
  (t) => [
    unique('artists_user_id_spotify_id_key').on(t.userId, t.spotifyId),
    uniqueIndex('artists_user_name').on(t.userId, sql`lower(${t.name})`),
    index('artists_next_check_idx').on(t.nextCheckAt),
    check('artists_source_check', sql`${t.source} in ('spotify','manual','demo')`),
  ],
);

export const scanRuns = pgTable(
  'scan_runs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    trigger: text('trigger').notNull(),
    startedAt: timestamp('started_at', tz).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', tz),
    artistsScanned: integer('artists_scanned').notNull().default(0),
    sweepRan: boolean('sweep_ran').notNull().default(false),
    itemsFetched: integer('items_fetched').notNull().default(0),
    itemsNew: integer('items_new').notNull().default(0),
    geminiCalls: integer('gemini_calls').notNull().default(0),
    showsNew: integer('shows_new').notNull().default(0),
    showsUpdated: integer('shows_updated').notNull().default(0),
    alertsSent: integer('alerts_sent').notNull().default(0),
    errors: jsonb('errors').notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [
    check(
      'scan_runs_trigger_check',
      sql`${t.trigger} in ('github_actions','vercel_cron','manual')`,
    ),
  ],
);

export const sourceItems = pgTable(
  'source_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    scanRunId: uuid('scan_run_id').references(() => scanRuns.id),
    // null for platform sweeps, which are not tied to a single artist
    artistId: uuid('artist_id').references(() => artists.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    query: text('query').notNull(),
    url: text('url').notNull(),
    urlHash: text('url_hash').notNull().unique(),
    title: text('title'),
    snippet: text('snippet'),
    publishedAt: timestamp('published_at', tz),
    fetchedAt: timestamp('fetched_at', tz).notNull().defaultNow(),
    processedAt: timestamp('processed_at', tz),
  },
  (t) => [
    check(
      'source_items_source_check',
      sql`${t.source} in ('google_news','tavily','gemini_search')`,
    ),
  ],
);

export const shows = pgTable(
  'shows',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    // artist_id|normalised_city|event_date
    dedupKey: text('dedup_key').notNull().unique(),
    eventName: text('event_name'),
    isFestival: boolean('is_festival').notNull().default(false),
    festivalName: text('festival_name'),
    city: text('city').notNull(),
    venue: text('venue'),
    eventDate: date('event_date'),
    datePrecision: text('date_precision').notNull().default('day'),
    ticketPlatform: text('ticket_platform'),
    ticketUrl: text('ticket_url'),
    onSaleAt: timestamp('on_sale_at', tz),
    status: text('status').notNull().default('announced'),
    earlyBirdStatus: text('early_bird_status').notNull().default('not_mentioned'),
    earlyBirdOpensAt: timestamp('early_bird_opens_at', tz),
    earlyBirdDeadline: timestamp('early_bird_deadline', tz),
    earlyBirdNote: text('early_bird_note'),
    priority: text('priority').notNull(),
    confidence: numeric('confidence', { precision: 3, scale: 2, mode: 'number' }).notNull(),
    evidence: text('evidence'),
    sourceUrls: text('source_urls').array().notNull().default(sql`'{}'::text[]`),
    firstSeenAt: timestamp('first_seen_at', tz).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  },
  (t) => [
    check('shows_date_precision_check', sql`${t.datePrecision} in ('day','month')`),
    check(
      'shows_status_check',
      sql`${t.status} in ('announced','on_sale','sold_out','cancelled')`,
    ),
    check(
      'shows_early_bird_status_check',
      sql`${t.earlyBirdStatus} in ('open','imminent','sold_out','closed','not_mentioned')`,
    ),
    check('shows_priority_check', sql`${t.priority} in ('P0','P1','P2','P3')`),
    index('shows_city_idx').on(t.city),
    index('shows_event_date_idx').on(t.eventDate),
  ],
);

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    showId: uuid('show_id')
      .notNull()
      .references(() => shows.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    alertType: text('alert_type').notNull(),
    channel: text('channel').notNull(),
    // show_id|alert_type|channel|change_ref — the idempotency key
    alertKey: text('alert_key').notNull().unique(),
    message: text('message').notNull(),
    deliveryStatus: text('delivery_status').notNull().default('pending'),
    error: text('error'),
    sentAt: timestamp('sent_at', tz),
  },
  (t) => [
    check(
      'alerts_alert_type_check',
      sql`${t.alertType} in ('new_show','early_bird_opened','early_bird_deadline_soon','show_updated')`,
    ),
    check('alerts_channel_check', sql`${t.channel} in ('telegram','email')`),
    check(
      'alerts_delivery_status_check',
      sql`${t.deliveryStatus} in ('pending','sent','failed')`,
    ),
  ],
);

export const aiCalls = pgTable(
  'ai_calls',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    scanRunId: uuid('scan_run_id').references(() => scanRuns.id),
    task: text('task').notNull(),
    model: text('model').notNull(),
    latencyMs: integer('latency_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    success: boolean('success').notNull(),
    error: text('error'),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  },
  (t) => [
    check('ai_calls_task_check', sql`${t.task} in ('extract','reconcile','alert','suggest','ground')`),
  ],
);

/**
 * Artists Gemini suggested based on who the user already follows. Kept out of
 * `artists` so a suggestion never reaches the scanner until it is accepted.
 */
export const artistSuggestions = pgTable(
  'artist_suggestions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
    similarTo: text('similar_to'),
    reason: text('reason'),
    imageUrl: text('image_url'),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('artist_suggestions_user_name').on(t.userId, sql`lower(${t.name})`),
    check('artist_suggestions_status_check', sql`${t.status} in ('pending','added','dismissed')`),
  ],
);

export type ArtistSuggestion = typeof artistSuggestions.$inferSelect;

/**
 * Candidates Gemini returned that the pipeline refused, with the reason.
 * Rejection is the hard part of this app, so it is recorded rather than
 * counted and discarded.
 */
export const rejections = pgTable(
  'rejections',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    scanRunId: uuid('scan_run_id').references(() => scanRuns.id),
    artistId: uuid('artist_id').references(() => artists.id, { onDelete: 'set null' }),
    /** The name Gemini matched, which may not be an artist we follow. */
    claimedArtist: text('claimed_artist').notNull(),
    reason: text('reason').notNull(),
    country: text('country'),
    city: text('city'),
    eventDate: text('event_date'),
    confidence: numeric('confidence', { precision: 3, scale: 2 }),
    evidence: text('evidence'),
    sourceUrl: text('source_url'),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  },
  (t) => [
    check(
      'rejections_reason_check',
      sql`${t.reason} in ('not_a_show_announcement','not_india','low_confidence','past_event','no_city','unknown_artist')`,
    ),
    index('rejections_created_idx').on(t.createdAt),
  ],
);

export type Rejection = typeof rejections.$inferSelect;

export type User = typeof users.$inferSelect;
export type Artist = typeof artists.$inferSelect;
export type ScanRun = typeof scanRuns.$inferSelect;
export type SourceItem = typeof sourceItems.$inferSelect;
export type Show = typeof shows.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type AiCall = typeof aiCalls.$inferSelect;
