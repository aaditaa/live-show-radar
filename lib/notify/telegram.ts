import { optionalEnv } from '@/lib/env';
import { errorMessage, fetchWithRetry } from '@/lib/http';

export const TELEGRAM_MAX_LENGTH = 4096;

export type SendResult = { ok: true; messageId: number } | { ok: false; error: string };

/**
 * Telegram rejects a message containing a tag it does not support, so strip
 * everything outside the allowed set rather than risk the whole send failing.
 */
export function sanitiseHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?!\/?(?:b|i|u|s|a|code|pre)\b)[^>]*>/gi, '')
    .trim();
}

export function isTelegramConfigured(): boolean {
  return Boolean(optionalEnv('TELEGRAM_BOT_TOKEN') && optionalEnv('TELEGRAM_CHAT_ID'));
}

export async function sendTelegramMessage(
  text: string,
  options: { chatId?: string; disablePreview?: boolean } = {},
): Promise<SendResult> {
  const token = optionalEnv('TELEGRAM_BOT_TOKEN');
  const chatId = options.chatId ?? optionalEnv('TELEGRAM_CHAT_ID');

  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not set' };
  if (!chatId) return { ok: false, error: 'TELEGRAM_CHAT_ID is not set' };

  const body = {
    chat_id: chatId,
    text: sanitiseHtml(text).slice(0, TELEGRAM_MAX_LENGTH),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: options.disablePreview ?? true },
  };

  try {
    const response = await fetchWithRetry(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      { timeoutMs: 10_000, label: 'telegram sendMessage' },
    );

    const payload = (await response.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id: number };
    };

    if (!payload.ok) {
      return { ok: false, error: payload.description ?? `HTTP ${response.status}` };
    }
    return { ok: true, messageId: payload.result?.message_id ?? 0 };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
