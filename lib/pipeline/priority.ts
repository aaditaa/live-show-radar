import { HOME_CITY, normaliseCity } from '@/lib/cities';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Candidates below 0.7 are discarded entirely, so everything stored is at least
 * 0.7. "Low confidence" for P3 is therefore the band just above that cut.
 */
export const KEEP_CONFIDENCE_MIN = 0.7;
export const LOW_CONFIDENCE_MAX = 0.8;

export const EARLY_BIRD_DEADLINE_SOON_HOURS = 72;

export type PriorityInput = {
  city: string | null;
  confidence: number;
  earlyBirdStatus: 'open' | 'imminent' | 'sold_out' | 'closed' | 'not_mentioned';
  earlyBirdDeadline: Date | null;
};

function deadlineWithinHours(deadline: Date | null, hours: number, now: Date): boolean {
  if (!deadline) return false;
  const ms = deadline.getTime() - now.getTime();
  return ms > 0 && ms <= hours * 60 * 60 * 1000;
}

/**
 * Priority is decided in code, never by the model. Gemini only explains the
 * result in the alert text.
 *
 * P0: Bengaluru AND early bird open or imminent
 * P1: Bengaluru, OR any Indian city with early bird open and a deadline within 72 h
 * P2: any other Indian city
 * P3: low confidence — dashboard only, no push
 */
export function computePriority(input: PriorityInput, now: Date = new Date()): Priority {
  if (input.confidence < LOW_CONFIDENCE_MAX) return 'P3';

  const isHome = normaliseCity(input.city) === HOME_CITY;
  const earlyBirdLive = input.earlyBirdStatus === 'open' || input.earlyBirdStatus === 'imminent';

  if (isHome && earlyBirdLive) return 'P0';
  if (isHome) return 'P1';
  if (
    input.earlyBirdStatus === 'open' &&
    deadlineWithinHours(input.earlyBirdDeadline, EARLY_BIRD_DEADLINE_SOON_HOURS, now)
  ) {
    return 'P1';
  }
  return 'P2';
}

/** P3 is dashboard-only: it never triggers a push. */
export function shouldPush(priority: Priority): boolean {
  return priority !== 'P3';
}
