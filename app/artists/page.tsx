import { asc, desc } from 'drizzle-orm';
import { artists, users } from '@/db/schema';
import { db } from '@/lib/db';
import { hasAdminSession } from '@/lib/auth';
import { isSpotifyConfigured } from '@/lib/spotify';
import { formatIstDateTime, formatRelative } from '@/lib/time';
import { AdminBar } from '@/components/admin-bar';
import { PageHeader } from '@/components/page-header';
import { IconStar } from '@/components/icons';
import { Flash } from '@/components/flash';
import { importArtistsAction, syncSpotifyAction, toggleStarAction } from '@/app/actions';

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

  const currentUser = user[0];
  const spotifyConnected = Boolean(currentUser?.spotifyRefreshToken);
  const counts = {
    spotify: rows.filter((r) => r.source === 'spotify').length,
    manual: rows.filter((r) => r.source === 'manual').length,
    demo: rows.filter((r) => r.source === 'demo').length,
    inactive: rows.filter((r) => !r.isActive).length,
  };

  return (
    <>
      <PageHeader
        title="Artists"
        subtitle={`${rows.length} watched · ${counts.spotify} from Spotify · ${counts.manual} manual · ${counts.demo} demo${
          counts.inactive > 0 ? ` · ${counts.inactive} inactive` : ''
        }. Starred artists are checked every 2 hours, the rest every 6.`}
      />

      <Flash
        done={params.connected ? 'Spotify connected. Use “Sync Spotify” to pull your follow list.' : params.done}
        error={params.error}
      />

      <AdminBar />

      {isAdmin ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Spotify</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {spotifyConnected
                ? `Connected${currentUser?.spotifyUserId ? ` as ${currentUser.spotifyUserId}` : ''}. Syncing never removes manual or demo artists; unfollowed Spotify artists are deactivated, not deleted.`
                : 'Not connected. Authorises read-only access to who you follow (scope user-follow-read).'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/api/spotify/login"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                {spotifyConnected ? 'Reconnect Spotify' : 'Connect Spotify'}
              </a>
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
              One name per line. Optional second CSV column for aliases, quoted if it contains
              commas. The system works fully without Spotify.
            </p>
            <form action={importArtistsAction} className="mt-3 space-y-2">
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
          </section>
        </div>
      ) : null}

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
                  {!isAdmin && artist.isStarred ? (
                    <IconStar filled className="mr-1 inline h-3.5 w-3.5 text-amber-300" />
                  ) : null}
                  {artist.name}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
