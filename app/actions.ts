'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { and, count, eq, not } from 'drizzle-orm';
import { artistSuggestions, artists, shows, users } from '@/db/schema';
import { db } from '@/lib/db';
import { ADMIN_COOKIE, adminSessionToken, checkAdminPassword, hasAdminSession } from '@/lib/auth';
import { backfillArtistImages, importArtists, syncSpotifyArtists } from '@/lib/artists';
import { optionalEnv } from '@/lib/env';
import { errorMessage } from '@/lib/http';
import { suggestArtists } from '@/lib/ai/suggest';
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
    // Pick up images for anyone still missing one, whatever their source.
    const images = await backfillArtistImages(user);
    return `Synced ${result.fetched} followed artists: ${result.added} added, ${result.reactivated} reactivated, ${result.unfollowed} deactivated.${
      images.checked > 0 ? ` Found ${images.found} new artist images.` : ''
    }`;
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

export async function removeArtistAction(formData: FormData): Promise<void> {
  const artistId = String(formData.get('artistId') ?? '');
  await runAdminAction('/artists', async () => {
    if (!artistId) throw new Error('No artist given.');

    // Say plainly what else goes with them: shows cascade on delete.
    const [{ value: showCount } = { value: 0 }] = await db
      .select({ value: count() })
      .from(shows)
      .where(eq(shows.artistId, artistId));

    const [removed] = await db
      .delete(artists)
      .where(eq(artists.id, artistId))
      .returning({ name: artists.name });

    if (!removed) throw new Error('That artist no longer exists.');
    return `Removed ${removed.name}${showCount > 0 ? ` and ${showCount} of their shows` : ''}.`;
  });
}

export async function suggestArtistsAction(): Promise<void> {
  await runAdminAction('/artists', async () => {
    const user = (await db.select().from(users).limit(1))[0];
    if (!user) throw new Error('No user row exists yet. Run npm run db:seed.');

    const followed = await db
      .select({ name: artists.name, isStarred: artists.isStarred })
      .from(artists)
      .where(eq(artists.isActive, true));

    const { suggestions, error } = await suggestArtists(followed, user.homeCity);
    if (error) throw new Error(`Gemini could not suggest artists: ${error}`);
    if (suggestions.length === 0) throw new Error('Gemini returned no suggestions.');

    // Anything already followed or already suggested is dropped by the unique
    // index; only genuinely new names land.
    const followedKeys = new Set(followed.map((a) => a.name.toLowerCase()));
    const fresh = suggestions.filter((s) => !followedKeys.has(s.name.toLowerCase()));

    const inserted = await db
      .insert(artistSuggestions)
      .values(
        fresh.map((s) => ({
          userId: user.id,
          name: s.name,
          aliases: s.aliases,
          similarTo: s.similar_to,
          reason: s.reason,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: artistSuggestions.id });

    return `Gemini suggested ${suggestions.length} artists; ${inserted.length} are new.`;
  });
}

export async function acceptSuggestionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('suggestionId') ?? '');
  await runAdminAction('/artists', async () => {
    const user = (await db.select().from(users).limit(1))[0];
    if (!user) throw new Error('No user row exists yet.');

    const [suggestion] = await db
      .select()
      .from(artistSuggestions)
      .where(and(eq(artistSuggestions.id, id), eq(artistSuggestions.userId, user.id)))
      .limit(1);
    if (!suggestion) throw new Error('That suggestion no longer exists.');

    await db
      .insert(artists)
      .values({
        userId: user.id,
        name: suggestion.name,
        aliases: suggestion.aliases,
        source: 'manual' as const,
      })
      .onConflictDoNothing();

    await db
      .update(artistSuggestions)
      .set({ status: 'added' })
      .where(eq(artistSuggestions.id, id));

    return `Added ${suggestion.name}. It will be scanned on the next run.`;
  });
}

export async function dismissSuggestionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('suggestionId') ?? '');
  await runAdminAction('/artists', async () => {
    const [dismissed] = await db
      .update(artistSuggestions)
      .set({ status: 'dismissed' })
      .where(eq(artistSuggestions.id, id))
      .returning({ name: artistSuggestions.name });
    if (!dismissed) throw new Error('That suggestion no longer exists.');
    return `Dismissed ${dismissed.name}.`;
  });
}

export async function fetchArtistImagesAction(): Promise<void> {
  await runAdminAction('/artists', async () => {
    const user = (await db.select().from(users).limit(1))[0];
    if (!user) throw new Error('No user row exists yet. Run npm run db:seed.');

    const result = await backfillArtistImages(user);
    if (result.checked === 0) return 'Every artist already has an image.';
    if (result.error) {
      throw new Error(`Spotify lookup failed after ${result.found} images: ${result.error}`);
    }
    return `Checked ${result.checked} artists, found ${result.found} images${
      result.missed > 0 ? `, ${result.missed} had no confident match` : ''
    }.`;
  });
}

export async function addArtistFromSearchAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const spotifyId = String(formData.get('spotifyId') ?? '').trim() || null;
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || null;

  await runAdminAction('/artists', async () => {
    if (!name) throw new Error('No artist given.');
    const user = (await db.select().from(users).limit(1))[0];
    if (!user) throw new Error('No user row exists yet. Run npm run db:seed.');

    const inserted = await db
      .insert(artists)
      .values({
        userId: user.id,
        name,
        aliases: [],
        spotifyId,
        imageUrl,
        // Found through Spotify, but not followed there. `source` records how
        // the artist joined the list, and a sync deactivates unfollowed
        // 'spotify' rows — marking this one 'spotify' would delete it later.
        source: 'manual' as const,
      })
      .onConflictDoNothing()
      .returning({ name: artists.name });

    if (inserted.length === 0) return `${name} is already on the list.`;
    return `Added ${name}. It will be scanned on the next run.`;
  });
}
