import { NextResponse } from 'next/server';
import { hasAdminSession, hasCronBearer } from '@/lib/auth';
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/notify/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proves the Telegram path end to end without waiting for a real show. */
export async function POST(request: Request) {
  if (!hasCronBearer(request) && !(await hasAdminSession())) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set' },
      { status: 400 },
    );
  }

  const result = await sendTelegramMessage(
    [
      '[BENGALURU] <b>Live Show Radar test alert</b>',
      '',
      'Artist: Test Artist',
      'Venue: TBA',
      'City: Bengaluru',
      'Date: TBA',
      'Early bird: not mentioned',
      '',
      'If you can read this, alert delivery works.',
    ].join('\n'),
  );

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, messageId: result.messageId });
}
