import { optionalEnv } from '@/lib/env';
import { errorMessage, fetchWithRetry } from '@/lib/http';
import { visibleText } from '@/lib/ai/alert';

export type EmailResult = { ok: true; id: string } | { ok: false; error: string };

/** Optional second channel. Silently unused unless both variables are set. */
export function isEmailConfigured(): boolean {
  return Boolean(optionalEnv('RESEND_API_KEY') && optionalEnv('ALERT_EMAIL'));
}

/**
 * Resend over plain fetch, matching how Telegram is called — no SDK for a
 * single endpoint.
 *
 * The alert body is Telegram HTML, which is a small, safe subset (b, i, a,
 * code), so it renders as-is in an email. A plain-text part is derived from
 * the same string rather than written twice.
 */
export async function sendAlertEmail(
  subject: string,
  html: string,
): Promise<EmailResult> {
  const apiKey = optionalEnv('RESEND_API_KEY');
  const to = optionalEnv('ALERT_EMAIL');

  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not set' };
  if (!to) return { ok: false, error: 'ALERT_EMAIL is not set' };

  try {
    const response = await fetchWithRetry(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Resend's shared sender, usable before a domain is verified.
          from: optionalEnv('ALERT_EMAIL_FROM') ?? 'Live Show Radar <onboarding@resend.dev>',
          to: [to],
          subject,
          html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;white-space:pre-wrap">${html}</div>`,
          text: visibleText(html),
        }),
      },
      { timeoutMs: 10_000, label: 'resend sendEmail' },
    );

    const body = (await response.json()) as { id?: string; message?: string; name?: string };

    if (!response.ok) {
      return { ok: false, error: body.message ?? body.name ?? `HTTP ${response.status}` };
    }
    return { ok: true, id: body.id ?? '' };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
