import { describe, expect, it } from 'vitest';
import { buildAlertKey, EARLY_BIRD_REMINDER_HOURS } from '../lib/pipeline/alerts';
import { alertTag, MAX_MESSAGE_LENGTH, visibleLength, visibleText } from '../lib/ai/alert';
import { sanitiseHtml, TELEGRAM_MAX_LENGTH } from '../lib/notify/telegram';
import { mergeShowFields } from '../lib/pipeline/reconcile-stage';
import type { Show } from '../db/schema';
import type { ShowCandidate } from '../lib/ai/schemas';
import type { AcceptedCandidate } from '../lib/pipeline/match';

const SHOW_ID = '22222222-2222-2222-2222-222222222222';

describe('buildAlertKey', () => {
  it('is show_id|alert_type|channel|change_ref', () => {
    expect(buildAlertKey(SHOW_ID, 'new_show', 'telegram', 'initial')).toBe(
      `${SHOW_ID}|new_show|telegram|initial`,
    );
  });

  it('is stable, so the same alert can never be sent twice', () => {
    expect(buildAlertKey(SHOW_ID, 'new_show', 'telegram', 'initial')).toBe(
      buildAlertKey(SHOW_ID, 'new_show', 'telegram', 'initial'),
    );
  });

  it('separates alert types for one show', () => {
    expect(buildAlertKey(SHOW_ID, 'new_show', 'telegram', 'initial')).not.toBe(
      buildAlertKey(SHOW_ID, 'early_bird_opened', 'telegram', 'initial'),
    );
  });

  it('lets a moved early-bird deadline alert again, but an unchanged one not', () => {
    const first = buildAlertKey(SHOW_ID, 'early_bird_deadline_soon', 'telegram', '2026-12-01T00:00:00.000Z');
    const same = buildAlertKey(SHOW_ID, 'early_bird_deadline_soon', 'telegram', '2026-12-01T00:00:00.000Z');
    const moved = buildAlertKey(SHOW_ID, 'early_bird_deadline_soon', 'telegram', '2026-12-05T00:00:00.000Z');
    expect(first).toBe(same);
    expect(first).not.toBe(moved);
  });

  it('separates channels', () => {
    expect(buildAlertKey(SHOW_ID, 'new_show', 'telegram', 'initial')).not.toBe(
      buildAlertKey(SHOW_ID, 'new_show', 'email', 'initial'),
    );
  });

  it('reminds 24 hours ahead', () => {
    expect(EARLY_BIRD_REMINDER_HOURS).toBe(24);
  });
});

describe('alertTag', () => {
  it('is [BUY TODAY] whenever the early bird is open', () => {
    expect(alertTag({ city: 'Bengaluru', earlyBirdStatus: 'open' })).toBe('[BUY TODAY]');
    expect(alertTag({ city: 'Mumbai', earlyBirdStatus: 'open' })).toBe('[BUY TODAY]');
  });

  it('is [BENGALURU] for the home city otherwise', () => {
    expect(alertTag({ city: 'Bengaluru', earlyBirdStatus: 'imminent' })).toBe('[BENGALURU]');
    expect(alertTag({ city: 'Bengaluru', earlyBirdStatus: 'not_mentioned' })).toBe('[BENGALURU]');
  });

  it('is [ELSEWHERE IN INDIA] for any other city', () => {
    expect(alertTag({ city: 'Pune', earlyBirdStatus: 'not_mentioned' })).toBe(
      '[ELSEWHERE IN INDIA]',
    );
  });

  it('caps the message well under the Telegram limit', () => {
    expect(MAX_MESSAGE_LENGTH).toBe(600);
    expect(MAX_MESSAGE_LENGTH).toBeLessThan(TELEGRAM_MAX_LENGTH);
  });
});

describe('sanitiseHtml', () => {
  it('keeps the tags Telegram supports', () => {
    const html = '<b>Bold</b> <i>it</i> <a href="https://x.com">link</a> <code>c</code>';
    expect(sanitiseHtml(html)).toBe(html);
  });

  it('strips tags Telegram would reject', () => {
    expect(sanitiseHtml('<div><b>Keep</b><script>bad()</script></div>')).toBe('<b>Keep</b>bad()');
  });

  it('turns <br> into a newline', () => {
    expect(sanitiseHtml('one<br>two')).toBe('one\ntwo');
  });
});

/* mergeShowFields: a null from the model means "not reported", never "cleared". */

const NOW = new Date('2026-10-11T00:00:00Z');

const STORED = {
  id: SHOW_ID,
  artistId: '11111111-1111-1111-1111-111111111111',
  dedupKey: 'k',
  eventName: 'Tour 2026',
  isFestival: false,
  festivalName: null,
  city: 'Bengaluru',
  venue: 'Phoenix Arena',
  eventDate: '2026-12-05',
  datePrecision: 'day',
  ticketPlatform: 'District',
  ticketUrl: 'https://district.in/a',
  onSaleAt: null,
  status: 'announced',
  earlyBirdStatus: 'not_mentioned',
  earlyBirdOpensAt: null,
  earlyBirdDeadline: null,
  earlyBirdNote: null,
  priority: 'P1',
  confidence: 0.9,
  evidence: 'e',
  sourceUrls: ['https://example.com/a'],
  firstSeenAt: NOW,
  updatedAt: NOW,
} as unknown as Show;

function accepted(overrides: Partial<ShowCandidate>): AcceptedCandidate {
  return {
    artistId: STORED.artistId,
    dedupKey: 'k',
    city: 'Bengaluru',
    eventDate: '2026-12-05',
    candidate: {
      artist_name: 'X',
      artist_match_confidence: 0.9,
      is_show_announcement: true,
      event_name: null,
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
      early_bird_status: 'not_mentioned',
      early_bird_opens_at: null,
      early_bird_deadline: null,
      early_bird_note: null,
      evidence: 'e',
      source_url: 'https://example.com/b',
      ...overrides,
    },
  };
}

describe('mergeShowFields', () => {
  it('never erases a known venue when the candidate omits it', () => {
    expect(mergeShowFields(STORED, accepted({}), NOW).venue).toBe('Phoenix Arena');
  });

  it('never downgrades early_bird_status back to not_mentioned', () => {
    const open = { ...STORED, earlyBirdStatus: 'open' } as Show;
    expect(mergeShowFields(open, accepted({}), NOW).earlyBirdStatus).toBe('open');
  });

  it('applies a genuine early-bird opening and lifts the show to P0', () => {
    const merged = mergeShowFields(STORED, accepted({ early_bird_status: 'open' }), NOW);
    expect(merged.earlyBirdStatus).toBe('open');
    expect(merged.priority).toBe('P0');
  });

  it('accumulates source urls without duplicating them', () => {
    expect(mergeShowFields(STORED, accepted({}), NOW).sourceUrls).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
    expect(
      mergeShowFields(STORED, accepted({ source_url: 'https://example.com/a' }), NOW).sourceUrls,
    ).toEqual(['https://example.com/a']);
  });

  it('keeps the higher confidence of the two', () => {
    expect(mergeShowFields(STORED, accepted({ artist_match_confidence: 0.75 }), NOW).confidence).toBe(
      0.9,
    );
    expect(mergeShowFields(STORED, accepted({ artist_match_confidence: 1 }), NOW).confidence).toBe(1);
  });
});

describe('visibleLength', () => {
  it('ignores markup, so a long href does not eat the budget', () => {
    const googleNewsHref = `https://news.google.com/rss/articles/${'A'.repeat(500)}?oc=5`;
    const message = `[BUY TODAY] <b>Guns N' Roses</b>\nCity: Bengaluru\n<a href="${googleNewsHref}">Source</a>`;
    expect(message.length).toBeGreaterThan(MAX_MESSAGE_LENGTH);
    expect(visibleLength(message)).toBeLessThan(MAX_MESSAGE_LENGTH);
  });

  it('counts the text a reader actually sees', () => {
    expect(visibleText('<b>Hello</b> <a href="https://example.com/very/long">link</a>')).toBe(
      'Hello link',
    );
  });

  it('decodes the entities Telegram HTML requires', () => {
    expect(visibleText('Rock &amp; Roll')).toBe('Rock & Roll');
  });

  it('still catches a genuinely over-long message', () => {
    expect(visibleLength('x'.repeat(700))).toBeGreaterThan(MAX_MESSAGE_LENGTH);
  });
});
