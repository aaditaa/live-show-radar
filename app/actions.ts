'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { eq, not } from 'drizzle-orm';
import { artists, users } from '@/db/schema';
import { db } from '@/lib/db';
import { ADMIN_COOKIE, adminSessionToken, checkAdminPassword, hasAdminSession } from '@/lib/auth';
import { importArtists, syncSpotifyArtists } from '@/lib/artists';
import { optionalEnv } from '@/lib/env';
import { runScan } from '@/lib/pipeline/scan';
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/notify/telegram';

async function requireAdmin(): Promise<void> {
  if (!(await hasAdminSession())) throw new Error('Admin session required');
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');

  if (!checkAdminPassword(password)) {
    revalidatePath('/artists');
    return;
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
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  revalidatePath('/', 'layout');
}

export async function importArtistsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = String(formData.get('artists') ?? '');
  const user = (await db.select().from(users).limit(1))[0];
  if (!user) throw new Error('No user');
  await importArtists(user, input);
  revalidatePath('/artists');
}

export async function toggleStarAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const artistId = String(formData.get('artistId') ?? '');
  if (!artistId) return;
  await db
    .update(artists)
    .set({ isStarred: not(artists.isStarred) })
    .where(eq(artists.id, artistId));
  revalidatePath('/artists');
}

export async function syncSpotifyAction(): Promise<void> {
  await requireAdmin();
  const user = (await db.select().from(users).limit(1))[0];
  if (!user) throw new Error('No user');
  await syncSpotifyArtists(user);
  revalidatePath('/artists');
}

export async function scanNowAction(): Promise<void> {
  await requireAdmin();
  await runScan('manual');
  revalidatePath('/', 'layout');
}

export async function sendTestAlertAction(): Promise<void> {
  await requireAdmin();
  if (!isTelegramConfigured()) throw new Error('Telegram is not configured');
  await sendTelegramMessage(
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
  revalidatePath('/alerts');
}
