import { asc, desc } from 'drizzle-orm';
import { artists } from '@/db/schema';
import { db } from '@/lib/db';
import { formatIstDateTime, formatRelative } from '@/lib/time';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  spotify: 'Spotify',
  manual: 'Manual',
  demo: 'Demo',
};

export default async function ArtistsPage() {
  const rows = await db
    .select()
    .from(artists)
    .orderBy(desc(artists.isStarred), asc(artists.name));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Artists</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {rows.length} artists watched. Starred artists are checked every 2 hours, the rest every
        6 hours. Spotify sync and manual import land in a later milestone.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Artist</th>
              <th className="px-4 py-2.5 font-medium">Aliases</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Last check</th>
              <th className="px-4 py-2.5 font-medium">Next check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((artist) => (
              <tr key={artist.id} className="text-zinc-300">
                <td className="px-4 py-2.5 font-medium text-white">
                  {artist.isStarred ? <span title="Starred">★ </span> : null}
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No artists yet. Run <code className="text-zinc-300">npm run db:seed</code>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
