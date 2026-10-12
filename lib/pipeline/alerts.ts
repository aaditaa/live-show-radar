import { and, eq, gt, isNotNull, lte } from 'drizzle-orm';
import { alerts, artists, shows, type Show, type User } from '@/db/schema';
import { db } from '@/lib/db';
import { writeAlert } from '@/lib/ai/alert';
import { sendTelegramMessage } from '@/lib/notify/telegram';
import { isEmailConfigured, sendAlertEmail } from '@/lib/notify/email';
import { shouldPush, type Priority } from '@/lib/pipeline/priority';
import type { SourceError } from '@/lib/sources/types';

export type AlertType =
  | 'new_show'
  | 'early_bird_opened'
  | 'early_bird_deadline_soon'
  | 'show_updated';

export const EARLY_BIRD_REMINDER_HOURS = 24;

/**
 * `show_id|alert_type|channel|change_ref` — unique in the database, so a retry
 * or an overlapping scan can never send the same alert twice.
 */
export function buildAlertKey(
  showId: string,
  alertType: AlertType,
  channel: 'telegram' | 'email',
  changeRef: string,
): string {
  return `${showId}|${alertType}|${channel}|${changeRef}`;
}

export type AlertRequest = {
  show: Show;
  artistName: string;
  alertType: AlertType;
  changeRef: string;
  changeNote?: string;
};

export type AlertOutcome = {
  sent: number;
  skipped: number;
  failed: number;
  errors: SourceError[];
};

/**
 * Claim the alert key before calling Gemini or Telegram. The insert is the
 * lock: if another run already claimed it, this one does no work at all.
 */
async function claimAlert(
  request: AlertRequest,
  user: User,
  channel: 'telegram' | 'email' = 'telegram',
): Promise<{ id: string } | null> {
  const alertKey = buildAlertKey(request.show.id, request.alertType, channel, request.changeRef);

  const claimed = await db
    .insert(alerts)
    .values({
      showId: request.show.id,
      userId: user.id,
      alertType: request.alertType,
      channel,
      alertKey,
      message: '',
      deliveryStatus: 'pending',
    })
    .onConflictDoNothing({ target: alerts.alertKey })
    .returning({ id: alerts.id });

  return claimed[0] ?? null;
}

export async function deliverAlerts(
  requests: readonly AlertRequest[],
  user: User,
  options: { scanRunId?: string | null } = {},
): Promise<AlertOutcome> {
  const outcome: AlertOutcome = { sent: 0, skipped: 0, failed: 0, errors: [] };

  for (const request of requests) {
    // P3 is dashboard only: no push, and no Gemini call to write one.
    if (!shouldPush(request.show.priority as Priority)) {
      outcome.skipped += 1;
      continue;
    }

    const claim = await claimAlert(request, user);
    if (!claim) {
      outcome.skipped += 1;
      continue;
    }

    const written = await writeAlert(
      {
        show: request.show,
        artistName: request.artistName,
        priority: request.show.priority as Priority,
        homeCity: user.homeCity,
        alertType: request.alertType,
        changeNote: request.changeNote,
      },
      { scanRunId: options.scanRunId },
    );

    if (!written.result) {
      await db
        .update(alerts)
        .set({ deliveryStatus: 'failed', error: written.error ?? 'alert writer failed' })
        .where(eq(alerts.id, claim.id));
      outcome.failed += 1;
      outcome.errors.push({
        source: 'gemini_search',
        query: `alert: ${request.artistName}`,
        message: written.error ?? 'alert writer failed',
      });
      continue;
    }

    if (written.warning) {
      outcome.errors.push({
        source: 'gemini_search',
        query: `alert: ${request.artistName}`,
        message: written.warning,
      });
    }

    const send = await sendTelegramMessage(written.result.message);

    if (send.ok) {
      await db
        .update(alerts)
        .set({
          message: written.result.message,
          deliveryStatus: 'sent',
          sentAt: new Date(),
          error: null,
        })
        .where(eq(alerts.id, claim.id));
      outcome.sent += 1;
    } else {
      await db
        .update(alerts)
        .set({ message: written.result.message, deliveryStatus: 'failed', error: send.error })
        .where(eq(alerts.id, claim.id));
      outcome.failed += 1;
      outcome.errors.push({
        source: 'tavily',
        query: `telegram: ${request.artistName}`,
        message: send.error,
      });
    }

    // Optional second channel. Claimed separately, so an email failure can
    // never suppress or duplicate the Telegram alert.
    if (isEmailConfigured()) {
      const emailClaim = await claimAlert(request, user, 'email');
      if (emailClaim) {
        const subject = written.result.headline || `${request.artistName} — live show`;
        const sentEmail = await sendAlertEmail(subject, written.result.message);
        await db
          .update(alerts)
          .set(
            sentEmail.ok
              ? {
                  message: written.result.message,
                  deliveryStatus: 'sent',
                  sentAt: new Date(),
                  error: null,
                }
              : {
                  message: written.result.message,
                  deliveryStatus: 'failed',
                  error: sentEmail.error,
                },
          )
          .where(eq(alerts.id, emailClaim.id));

        if (sentEmail.ok) outcome.sent += 1;
        else {
          outcome.failed += 1;
          outcome.errors.push({
            source: 'tavily',
            query: `email: ${request.artistName}`,
            message: sentEmail.error,
          });
        }
      }
    }
  }

  return outcome;
}

/**
 * Shows whose early-bird window closes within 24 hours. The deadline itself is
 * the change_ref, so moving a deadline can legitimately alert again while an
 * unchanged one never does.
 */
export async function findEarlyBirdDeadlinesDue(
  now: Date = new Date(),
): Promise<{ show: Show; artistName: string }[]> {
  const cutoff = new Date(now.getTime() + EARLY_BIRD_REMINDER_HOURS * 60 * 60 * 1000);

  const rows = await db
    .select({ show: shows, artistName: artists.name })
    .from(shows)
    .innerJoin(artists, eq(shows.artistId, artists.id))
    .where(
      and(
        isNotNull(shows.earlyBirdDeadline),
        gt(shows.earlyBirdDeadline, now),
        lte(shows.earlyBirdDeadline, cutoff),
        eq(shows.earlyBirdStatus, 'open'),
      ),
    );

  return rows.map((row) => ({ show: row.show, artistName: row.artistName }));
}
