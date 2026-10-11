import { callGemini } from '@/lib/ai/client';
import {
  ALERT_RESPONSE_SCHEMA,
  alertResponseSchema,
  type AlertResponse,
} from '@/lib/ai/schemas';
import type { Show } from '@/db/schema';
import { HOME_CITY } from '@/lib/cities';
import { formatEventDate, formatIstDateTime } from '@/lib/time';
import type { Priority } from '@/lib/pipeline/priority';

export const MAX_MESSAGE_LENGTH = 600;

/**
 * The 600-character budget is measured against what the reader sees, not the
 * raw HTML. Google News article links are ~500-character base64 redirects, so
 * counting href attributes would blow the budget on the link alone while the
 * visible message stays short. Telegram's own 4096-character wire limit still
 * applies to the full HTML.
 */
export function visibleLength(html: string): number {
  return visibleText(html).length;
}

export function visibleText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** The tag is decided in code so it can never contradict the priority rules. */
export function alertTag(show: Pick<Show, 'city' | 'earlyBirdStatus'>): string {
  if (show.earlyBirdStatus === 'open') return '[BUY TODAY]';
  return show.city === HOME_CITY ? '[BENGALURU]' : '[ELSEWHERE IN INDIA]';
}

/** Gemini Task 3: explain the priority and write the Telegram message. */
export const ALERT_SYSTEM_PROMPT = `You write a short Telegram alert about a live show for one person.

The priority has already been decided by rules. Do not change it: echo the priority you are given and explain it in "reason".

The message must:
- Start with the exact tag you are given, e.g. "[BUY TODAY] ".
- Include the artist, venue, city and date.
- Include an early-bird line stating the status, the deadline if there is one, and the words "Buy today" when the early bird is open.
- Include the ticket link and the source link.
- Use "TBA" for anything unknown. Never guess a venue, date, price or link.
- Be at most ${MAX_MESSAGE_LENGTH} characters.

Format with Telegram HTML only: <b>, <i>, <a href="...">, <code>. No Markdown, no <br>, no other tags. Write plainly, no emoji, no hype.

action_by is the ISO 8601 datetime the reader must act by — the early-bird deadline when there is one, otherwise null.`;

export type AlertContext = {
  show: Show;
  artistName: string;
  priority: Priority;
  homeCity: string;
  alertType: 'new_show' | 'early_bird_opened' | 'early_bird_deadline_soon' | 'show_updated';
  changeNote?: string;
};

function describeForAlert(context: AlertContext): string {
  const { show } = context;
  return JSON.stringify(
    {
      artist: context.artistName,
      event_name: show.eventName,
      is_festival: show.isFestival,
      festival_name: show.festivalName,
      city: show.city,
      venue: show.venue ?? 'TBA',
      date: formatEventDate(show.eventDate, show.datePrecision as 'day' | 'month'),
      date_precision: show.datePrecision,
      status: show.status,
      ticket_platform: show.ticketPlatform ?? 'TBA',
      ticket_url: show.ticketUrl ?? null,
      source_url: show.sourceUrls[0] ?? null,
      early_bird_status: show.earlyBirdStatus,
      early_bird_deadline: show.earlyBirdDeadline
        ? formatIstDateTime(show.earlyBirdDeadline)
        : null,
      early_bird_deadline_iso: show.earlyBirdDeadline?.toISOString() ?? null,
      early_bird_note: show.earlyBirdNote,
      evidence: show.evidence,
    },
    null,
    2,
  );
}

export async function writeAlert(
  context: AlertContext,
  options: { scanRunId?: string | null } = {},
): Promise<{ result: AlertResponse | null; error?: string; warning?: string }> {
  const tag = alertTag(context.show);

  const call = await callGemini({
    task: 'alert',
    systemInstruction: ALERT_SYSTEM_PROMPT,
    prompt: `Home city: ${context.homeCity}
Priority (decided by rules, do not change): ${context.priority}
Tag to start the message with: ${tag}
Alert type: ${context.alertType}${context.changeNote ? `\nWhat changed: ${context.changeNote}` : ''}

SHOW:
${describeForAlert(context)}`,
    responseSchema: ALERT_RESPONSE_SCHEMA,
    validator: alertResponseSchema,
    scanRunId: options.scanRunId,
  });

  if (!call.ok) return { result: null, error: call.error };

  const overBudget = visibleLength(call.data.message) > MAX_MESSAGE_LENGTH;

  // The rules own the priority; the model only explains it.
  return {
    result: { ...call.data, priority: context.priority },
    ...(overBudget
      ? {
          warning: `message was ${visibleLength(call.data.message)} visible characters, over ${MAX_MESSAGE_LENGTH}`,
        }
      : {}),
  };
}
