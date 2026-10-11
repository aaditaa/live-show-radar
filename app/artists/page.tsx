import { and, asc, desc, eq } from 'drizzle-orm';
import { artistSuggestions, artists, users } from '@/db/schema';
import { db } from '@/lib/db';
import { hasAdminSession } from '@/lib/auth';
import { isSpotifyConfigured } from '@/lib/spotify';
import { formatIstDateTime, formatRelative } from '@/lib/time';
import { AdminBar } from '@/components/admin-bar';
import { PageHeader } from '@/components/page-header';
import { IconSparkle, IconStar, IconTrash } from '@/components/icons';
import { ArtistAvatar } from '@/components/artist-avatar';
import { ArtistSearch } from '@/components/artist-search';
import { Flash } from '@/components/flash';
import {
  acceptSuggestionAction,
  dismissSuggestionAction,
  fetchArtistImagesAction,
  importArtistsAction,
  removeArtistAction,
  suggestArtistsAction,
  syncSpotifyAction,
  toggleStarAction,
} from '@/app/actions';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  spotify: 'Spotify',
  manual: 'Manual',
  demo: 'Demo',
};

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; done?: string }>;
}) {
  const params = await searchParams;
  const [rows, user, isAdmin] = await Promise.all([
    db.select().from(artists).orderBy(desc(artists.isStarred), asc(artists.name)),
    db.select().from(users).limit(1),
    hasAdminSession(),
  ]);

  const suggestions = await db
    .select()
    .from(artistSuggestions)
    .where(
      user[0]
        ? and(
            eq(artistSuggestions.userId, user[0].id),
            eq(artistSuggestions.status, 'pending'),
          )
        : eq(artistSuggestions.status, 'pending'),
    )
    .orderBy(asc(artistSuggestions.createdAt))
    .limit(12);

  const currentUser = user[0];
  const spotifyConnected = Boolean(currentUser?.spotifyRefreshToken);
  const counts = {
    spotify: rows.filter((r) => r.source === 'spotify').length,
    manual: rows.filter((r) => r.source === 'manual').length,
    inactive: rows.filter((r) => !r.isActive).length,
  };

  return (
    <>
      <PageHeader
        title="Artists"
        subtitle={`${rows.length} watched · ${counts.spotify} from Spotify · ${counts.manual} added manually${
          counts.inactive > 0 ? ` · ${counts.inactive} inactive` : ''
        }. Starred artists are checked every 2 hours, the rest every 6.`}
      />

      <Flash
        done={params.connected ? 'Spotify connected. Use “Sync Spotify” to pull your follow list.' : params.done}
        error={params.error}
      />

      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted-dim)]">
            <tr>
              {isAdmin ? <th className="px-4 py-3 font-medium">Star</th> : null}
              <th className="px-4 py-3 font-medium">Artist</th>
              <th className="px-4 py-3 font-medium">Aliases</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Last check</th>
              <th className="px-4 py-3 font-medium">Next check</th>
              {isAdmin ? <th className="px-4 py-3 font-medium">Remove</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((artist) => (
              <tr
                key={artist.id}
                className={artist.isActive ? 'text-[var(--muted)] transition hover:bg-white/[0.02]' : 'text-[var(--muted-dim)] line-through'}
              >
                {isAdmin ? (
                  <td className="px-4 py-3">
                    <form action={toggleStarAction}>
                      <input type="hidden" name="artistId" value={artist.id} />
                      <button
                        type="submit"
                        title={artist.isStarred ? 'Unstar' : 'Star'}
                        className={
                          artist.isStarred
                            ? 'text-amber-300 transition hover:text-amber-200'
                            : 'text-[var(--muted-dim)] transition hover:text-amber-300'
                        }
                      >
                        <IconStar filled={artist.isStarred} />
                      </button>
                    </form>
                  </td>
                ) : null}
                <td className="px-4 py-3 font-medium text-white">
                  <span className="flex items-center gap-2.5">
                    <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} size="sm" />
                    <span className="truncate">
                      {!isAdmin && artist.isStarred ? (
                        <IconStar filled className="mr-1 inline h-3.5 w-3.5 text-amber-300" />
                      ) : null}
                      {artist.name}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--muted-dim)]">
                  {artist.aliases.length > 0 ? artist.aliases.join(', ') : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-[var(--line)] bg-[var(--panel-raised)] px-2 py-0.5 text-[11px]">
                    {SOURCE_LABEL[artist.source] ?? artist.source}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--muted-dim)]">
                  {artist.lastCheckedAt ? formatRelative(artist.lastCheckedAt) : 'never'}
                </td>
                <td className="px-4 py-3 text-[var(--muted-dim)]">
                  {formatIstDateTime(artist.nextCheckAt)}
                </td>
                {isAdmin ? (
                  <td className="px-4 py-3">
                    <form action={removeArtistAction}>
                      <input type="hidden" name="artistId" value={artist.id} />
                      <button
                        type="submit"
                        title={`Remove ${artist.name} and any shows found for them`}
                        className="text-[var(--muted-dim)] transition hover:text-rose-300"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-[15px] font-semibold">Manage</h2>
      {isAdmin || suggestions.length > 0 ? (
        <section className="panel mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <IconSparkle className="text-[var(--accent)]" />
                Suggested artists
              </h2>
              <p className="mt-1 max-w-prose text-xs text-[var(--muted)]">
                Gemini suggests artists close to the ones you already follow and likely to play
                India. Spotify&apos;s own recommendations API is not available to apps created
                after November 2024, so this uses the same model as the rest of the pipeline.
              </p>
            </div>
            {isAdmin ? (
              <form action={suggestArtistsAction}>
                <button
                  type="submit"
                  className="rounded-xl border border-[var(--line)] bg-[var(--panel-raised)] px-4 py-2 text-sm transition hover:border-white/25"
                >
                  {suggestions.length > 0 ? 'Suggest more' : 'Suggest artists'}
                </button>
              </form>
            ) : null}

      <AdminBar />

      {isAdmin ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Spotify</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {spotifyConnected
                ? `Connected${currentUser?.spotifyUserId ? ` as ${currentUser.spotifyUserId}` : ''}. Syncing never removes manual or demo artists; unfollowed Spotify artists are deactivated, not deleted.`
                : 'Not connected. Authorises read-only access to who you follow (scope user-follow-read).'}{' '}
              Fetching images looks artists up by name and never changes their source, which
              records how they joined the list and drives what a sync may deactivate.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/api/spotify/login"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                {spotifyConnected ? 'Reconnect Spotify' : 'Connect Spotify'}
              </a>
              <form action={fetchArtistImagesAction}>
                <button
                  type="submit"
                  className="rounded-xl border border-[var(--line)] bg-[var(--panel-raised)] px-4 py-2 text-sm transition hover:border-white/25"
                >
                  Fetch images
                </button>
              </form>
              {spotifyConnected ? (
                <form action={syncSpotifyAction}>
                  <button
                    type="submit"
                    className="rounded-xl border border-[var(--line)] bg-[var(--panel-raised)] px-4 py-2 text-sm transition hover:border-white/25"
                  >
                    Sync Spotify
                  </button>
                </form>
              ) : null}
            </div>
            {!isSpotifyConfigured() ? (
              <p className="mt-2 text-xs text-rose-300">
                Server is missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET.
              </p>
            ) : null}
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Add artists</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Search Spotify&apos;s catalogue and add anyone, followed or not. Added artists are
              scanned exactly like the rest.
            </p>
            <div className="mt-3">
              <ArtistSearch />
            </div>

            <details className="mt-4 border-t border-[var(--line)] pt-3">
              <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-white">
                Paste or import a CSV instead
              </summary>
              <p className="mt-2 text-xs text-[var(--muted-dim)]">
                One name per line. Optional second column for aliases, quoted if it contains
                commas. Works with no Spotify connection at all.
              </p>
              <form action={importArtistsAction} className="mt-2 space-y-2">
                <textarea
                  name="artists"
                  rows={4}
                  placeholder={'Prateek Kuhad\nRitviz, "Ritviz Srivastava"'}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg-deep)] px-3 py-2.5 font-mono text-xs placeholder:text-[var(--muted-dim)]"
                />
                <button
                  type="submit"
                  className="rounded-xl border border-[var(--line)] bg-[var(--panel-raised)] px-4 py-2 text-sm transition hover:border-white/25"
                >
                  Import
                </button>
              </form>
            </details>
          </section>
        </div>
      ) : null}


          </div>

          {suggestions.length > 0 ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-raised)] p-3"
                >
                  <ArtistAvatar name={suggestion.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{suggestion.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                      {suggestion.reason}
                    </p>
                    {suggestion.similarTo ? (
                      <p className="mt-1 text-[11px] text-[var(--muted-dim)]">
                        like {suggestion.similarTo}
                      </p>
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <form action={acceptSuggestionAction}>
                        <input type="hidden" name="suggestionId" value={suggestion.id} />
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[var(--accent-hover)]"
                        >
                          Add
                        </button>
                      </form>
                      <form action={dismissSuggestionAction}>
                        <input type="hidden" name="suggestionId" value={suggestion.id} />
                        <button
                          type="submit"
                          className="w-full rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition hover:text-white"
                        >
                          No
                        </button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--muted-dim)]">
              No suggestions yet.
            </p>
          )}
        </section>
      ) : null}

    </>
  );
}
