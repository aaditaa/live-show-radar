import { eq } from 'drizzle-orm';
import { shows, type Show } from '@/db/schema';
import { db } from '@/lib/db';
import { reconcileShow } from '@/lib/ai/reconcile';
import type { EarlyBirdStatus, MaterialChange } from '@/lib/ai/schemas';
import { computePriority, type Priority } from '@/lib/pipeline/priority';
import { parseTimestamp, type AcceptedCandidate } from '@/lib/pipeline/match';
import type { SourceError } from '@/lib/sources/types';

/** Which material changes are worth waking someone up for. */
const ALERTABLE: Record<MaterialChange, boolean> = {
  none: false,
  early_bird_opened: true,
  early_bird_deadline_set: true,
  venue_announced: true,
  date_changed: true,
  on_sale_announced: true,
  sold_out: true,
  cancelled: true,
};

export type ReconcileStageResult = {
  geminiCalls: number;
  updated: { show: Show; materialChange: MaterialChange; summary: string }[];
  errors: SourceError[];
};

/**
 * Apply the fields a candidate genuinely adds. A null from the candidate means
 * "not reported", never "cleared", so stored values are only ever filled in or
 * replaced, not erased.
 */
export function mergeShowFields(stored: Show, accepted: AcceptedCandidate, now: Date) {
  const { candidate } = accepted;

  const earlyBirdStatus: EarlyBirdStatus =
    candidate.early_bird_status !== 'not_mentioned'
      ? candidate.early_bird_status
      : (stored.earlyBirdStatus as EarlyBirdStatus);
  const earlyBirdDeadline =
    parseTimestamp(candidate.early_bird_deadline) ?? stored.earlyBirdDeadline;

  const priority: Priority = computePriority(
    {
      city: stored.city,
      confidence: Math.max(stored.confidence, candidate.artist_match_confidence),
      earlyBirdStatus,
      earlyBirdDeadline,
    },
    now,
  );

  const sourceUrls = stored.sourceUrls.includes(candidate.source_url)
    ? stored.sourceUrls
    : [...stored.sourceUrls, candidate.source_url];

  return {
    eventName: candidate.event_name ?? stored.eventName,
    festivalName: candidate.festival_name ?? stored.festivalName,
    isFestival: candidate.is_festival || stored.isFestival,
    venue: candidate.venue ?? stored.venue,
    ticketPlatform: candidate.ticket_platform ?? stored.ticketPlatform,
    ticketUrl: candidate.ticket_url ?? stored.ticketUrl,
    onSaleAt: parseTimestamp(candidate.on_sale_at) ?? stored.onSaleAt,
    earlyBirdStatus,
    earlyBirdOpensAt: parseTimestamp(candidate.early_bird_opens_at) ?? stored.earlyBirdOpensAt,
    earlyBirdDeadline,
    earlyBirdNote: candidate.early_bird_note ?? stored.earlyBirdNote,
    confidence: Math.max(stored.confidence, candidate.artist_match_confidence),
    sourceUrls,
    priority,
    updatedAt: now,
  };
}

/** Gemini Task 2 for each candidate that matched an existing show. */
export async function runReconcileStage(
  matches: readonly { accepted: AcceptedCandidate; existing: Show }[],
  options: { scanRunId: string; now?: Date },
): Promise<ReconcileStageResult> {
  const now = options.now ?? new Date();
  const result: ReconcileStageResult = { geminiCalls: 0, updated: [], errors: [] };

  for (const match of matches) {
    const { result: verdict, error } = await reconcileShow(match.existing, match.accepted.candidate, {
      scanRunId: options.scanRunId,
    });
    result.geminiCalls += 1;

    if (!verdict) {
      result.errors.push({
        source: 'gemini_search',
        query: `reconcile: ${match.existing.dedupKey}`,
        message: error ?? 'reconcile failed',
      });
      continue;
    }

    // Different show behind the same dedup key: leave the stored row alone.
    if (!verdict.same_show) continue;
    if (verdict.changes.length === 0 && verdict.material_change === 'none') continue;

    const patch = mergeShowFields(match.existing, match.accepted, now);
    const [updated] = await db
      .update(shows)
      .set(patch)
      .where(eq(shows.id, match.existing.id))
      .returning();

    if (updated && ALERTABLE[verdict.material_change]) {
      result.updated.push({
        show: updated,
        materialChange: verdict.material_change,
        summary: verdict.changes
          .slice(0, 3)
          .map((change) => `${change.field}: ${change.old ?? 'TBA'} -> ${change.new ?? 'TBA'}`)
          .join('; '),
      });
    }
  }

  return result;
}
