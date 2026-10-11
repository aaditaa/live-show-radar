'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { eq, not } from 'drizzle-orm';
import { artists, users } from '@/db/schema';
import { db } from '@/lib/db';
import { ADMIN_COOKIE, adminSessionToken, checkAdminPassword, hasAdminSession } from '@/lib/auth';
import { importArtists, syncSpotifyArtists } from '@/lib/artists';
import { optionalEnv } from '@/lib/env';
import { errorMessage } from '@/lib/http';
import { runScan } from '@/lib/pipeline/scan';
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/notify/telegram';

/**
 * Run an admin action and always come back to a page that can explain itself.
 * An uncaught throw here would render a blank 500 and tell the user nothing,
 * so every failure is turned into a readable message in the query string.
 */
async function runAdminAction(
  path: string,
  work: () => Promise<string>,
): Promise<never> {
  let outcome: string;

  if (!(await hasAdminSession())) {
    outcome = 'error=admin_required';
  } else {
    try {
      outcome = `done=${encodeURIComponent(await work())}`;
    } catch (caught) {
      outcome = `error=${encodeURIComponent(errorMessage(caught))}`;
    }
  }

  revalidatePath(path);
  // redirect() signals by throwing, so it must sit outside the try block.
  redirect(`${path}?${outcome}`);
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');

  if (!checkAdminPassword(password)) {
    redirect('/artists?error=bad_password');
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, adminSessionToken(optionalEnv('ADMIN_PASSWORD') ?? ''), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  revalidatePath('/', 'layout');
  redirect('/artists?done=Signed%20in');
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  revalidatePath('/', 'layout');
  redirect('/artists');
}

export async function importArtistsAction(formData: FormData): Promise<void> {
  const input = String(formData.get('artists') ?? '');
  await runAdminAction('/artists', async () => {
    const user = (await db.select().from(users).limit(1))[0];
    if (!user) throw new Error('No user row exists yet. Run npm run db:seed.');
    const result = await importArtists(user, input);
    if (result.added === 0 && result.skipped === 0) throw new Error('Nothing to import.');
    return `Added ${result.added} artist${result.added === 1 ? '' : 's'}${
      result.skipped > 0 ? `, skipped ${result.skipped} already on the list` : ''
    }.`;
  });
}

export async function toggleStarAction(formData: FormData): Promise<void> {
  const artistId = String(formData.get('artistId') ?? '');
  await runAdminAction('/artists', async () => {
    if (!artistId) throw new Error('No artist given.');
    const [updated] = await db
      .update(artists)
      .set({ isStarred: not(artists.isStarred) })
      .where(eq(artists.id, artistId))
      .returning({ name: artists.name, isStarred: artists.isStarred });
    if (!updated) throw new Error('That artist no longer exists.');
    return `${updated.name} ${updated.isStarred ? 'starred' : 'unstarred'}.`;
  });
}

export async function syncSpotifyAction(): Promise<void> {
  await runAdminAction('/artists', async () => {
    const user = (await db.select().from(users).limit(1))[0];
    if (!user) throw new Error('No user row exists yet. Run npm run db:seed.');
    const result = await syncSpotifyArtists(user);
    return `Synced ${result.fetched} followed artists: ${result.added} added, ${result.reactivated} reactivated, ${result.unfollowed} deactivated.`;
  });
}

export async function scanNowAction(): Promise<void> {
  await runAdminAction('/scans', async () => {
    const summary = await runScan('manual');
    return `Scanned ${summary.artistsScanned} artists: ${summary.itemsNew} new items, ${summary.showsNew} new shows, ${summary.alertsSent} alerts sent.`;
  });
}

export async function sendTestAlertAction(): Promise<void> {
  await runAdminAction('/alerts', async () => {
    if (!isTelegramConfigured()) {
      throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set on the server.');
    }
    const sent = await sendTelegramMessage(
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
    if (!sent.ok) throw new Error(`Telegram refused the message: ${sent.error}`);
    return 'Test alert sent to Telegram.';
  });
}
