import { asc, desc } from 'drizzle-orm';
import { artists, users } from '@/db/schema';
import { db } from '@/lib/db';
import { hasAdminSession } from '@/lib/auth';
import { isSpotifyConfigured } from '@/lib/spotify';
import { formatIstDateTime, formatRelative } from '@/lib/time';
import { AdminBar } from '@/components/admin-bar';
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
      <h1 className="text-2xl font-semibold tracking-tight text-white">Artists</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {rows.length} watched · {counts.spotify} from Spotify · {counts.manual} manual ·{' '}
        {counts.demo} demo
        {counts.inactive > 0 ? ` · ${counts.inactive} inactive` : ''}. Starred artists are checked
        every 2 hours, the rest every 6.
      </p>

      <Flash
        done={params.connected ? 'Spotify connected. Use “Sync Spotify” to pull your follow list.' : params.done}
        error={params.error}
      />

      <AdminBar />

      {isAdmin ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-medium text-white">Spotify</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {spotifyConnected
                ? `Connected${currentUser?.spotifyUserId ? ` as ${currentUser.spotifyUserId}` : ''}. Syncing never removes manual or demo artists; unfollowed Spotify artists are deactivated, not deleted.`
                : 'Not connected. Authorises read-only access to who you follow (scope user-follow-read).'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/api/spotify/login"
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-200"
              >
                {spotifyConnected ? 'Reconnect Spotify' : 'Connect Spotify'}
              </a>
              {spotifyConnected ? (
                <form action={syncSpotifyAction}>
                  <button
                    type="submit"
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/30"
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

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-medium text-white">Add artists</h2>
            <p className="mt-1 text-xs text-zinc-500">
              One name per line. Optional second CSV column for aliases, quoted if it contains
              commas. The system works fully without Spotify.
            </p>
            <form action={importArtistsAction} className="mt-3 space-y-2">
              <textarea
                name="artists"
                rows={4}
                placeholder={'Prateek Kuhad\nRitviz, "Ritviz Srivastava"'}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600"
              />
              <button
                type="submit"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/30"
              >
                Import
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {isAdmin ? <th className="px-4 py-2.5 font-medium">Star</th> : null}
              <th className="px-4 py-2.5 font-medium">Artist</th>
              <th className="px-4 py-2.5 font-medium">Aliases</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Last check</th>
              <th className="px-4 py-2.5 font-medium">Next check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((artist) => (
              <tr
                key={artist.id}
                className={artist.isActive ? 'text-zinc-300' : 'text-zinc-600 line-through'}
              >
                {isAdmin ? (
                  <td className="px-4 py-2.5">
                    <form action={toggleStarAction}>
                      <input type="hidden" name="artistId" value={artist.id} />
                      <button
                        type="submit"
                        title={artist.isStarred ? 'Unstar' : 'Star'}
                        className="text-base leading-none text-amber-300 hover:text-amber-200"
                      >
                        {artist.isStarred ? '★' : '☆'}
                      </button>
                    </form>
                  </td>
                ) : null}
                <td className="px-4 py-2.5 font-medium text-white">
                  {!isAdmin && artist.isStarred ? <span title="Starred">★ </span> : null}
                  {artist.name}
                </td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {artist.aliases.length > 0 ? artist.aliases.join(', ') : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs ring-1 ring-inset ring-white/10">
                    {SOURCE_LABEL[artist.source] ?? artist.source}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {artist.lastCheckedAt ? formatRelative(artist.lastCheckedAt) : 'never'}
                </td>
                <td className="px-4 py-2.5 text-zinc-500">
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
