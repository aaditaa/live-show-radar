import { callGemini } from '@/lib/ai/client';
import {
  RECONCILE_RESPONSE_SCHEMA,
  reconcileResponseSchema,
  type ReconcileResponse,
  type ShowCandidate,
} from '@/lib/ai/schemas';
import type { Show } from '@/db/schema';

/** Gemini Task 2: decide whether a new candidate is the same show, and what changed. */
export const RECONCILE_SYSTEM_PROMPT = `You compare a live show already on record with a newly found candidate for what may be the same show.

Decide:
1. same_show: true when both describe the same performance by the same artist. Same artist, same city and the same date is the same show even when the venue or wording differs. A different date in the same city is a different show, unless the text says the date moved.
2. changes: one entry per field that genuinely differs, with the old and new value as short strings. Only list a field when the new candidate actually states a different value. A field the candidate leaves null is not a change — it is simply unreported, and the old value stands.
3. material_change: the single most important change, or "none".
   - early_bird_opened: early-bird or pre-sale tickets are now on sale and were not before.
   - early_bird_deadline_set: an early-bird deadline is now known and was not before.
   - venue_announced: a venue is now known and was not before.
   - date_changed: the show moved to a different date.
   - on_sale_announced: general tickets are now on sale.
   - sold_out: the show or its early bird sold out.
   - cancelled: the show was cancelled.

Never invent a value. If the candidate does not support a change, report no change.`;

function describeShow(show: Show): string {
  return JSON.stringify(
    {
      artist_known_as: show.eventName,
      city: show.city,
      venue: show.venue,
      event_date: show.eventDate,
      date_precision: show.datePrecision,
      is_festival: show.isFestival,
      festival_name: show.festivalName,
      status: show.status,
      ticket_platform: show.ticketPlatform,
      ticket_url: show.ticketUrl,
      on_sale_at: show.onSaleAt?.toISOString() ?? null,
      early_bird_status: show.earlyBirdStatus,
      early_bird_opens_at: show.earlyBirdOpensAt?.toISOString() ?? null,
      early_bird_deadline: show.earlyBirdDeadline?.toISOString() ?? null,
      early_bird_note: show.earlyBirdNote,
    },
    null,
    2,
  );
}

export async function reconcileShow(
  stored: Show,
  candidate: ShowCandidate,
  options: { scanRunId?: string | null } = {},
): Promise<{ result: ReconcileResponse | null; error?: string }> {
  const call = await callGemini({
    task: 'reconcile',
    systemInstruction: RECONCILE_SYSTEM_PROMPT,
    prompt: `STORED SHOW:
${describeShow(stored)}

NEW CANDIDATE:
${JSON.stringify(candidate, null, 2)}`,
    responseSchema: RECONCILE_RESPONSE_SCHEMA,
    validator: reconcileResponseSchema,
    scanRunId: options.scanRunId,
  });

  if (!call.ok) return { result: null, error: call.error };
  return { result: call.data };
}
