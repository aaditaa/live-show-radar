import { desc, eq } from 'drizzle-orm';
import { alerts, artists, shows } from '@/db/schema';
import { db } from '@/lib/db';
import { formatIstDateTime, formatRelative } from '@/lib/time';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  sent: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  failed: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  pending: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
};

const TYPE_LABEL: Record<string, string> = {
  new_show: 'New show',
  early_bird_opened: 'Early bird opened',
  early_bird_deadline_soon: 'Deadline soon',
  show_updated: 'Show updated',
};

export default async function AlertsPage() {
  const rows = await db
    .select({
      alert: alerts,
      artistName: artists.name,
      city: shows.city,
      priority: shows.priority,
    })
    .from(alerts)
    .innerJoin(shows, eq(alerts.showId, shows.id))
    .innerJoin(artists, eq(shows.artistId, artists.id))
    .orderBy(desc(alerts.sentAt), desc(alerts.id))
    .limit(100);

  const sent = rows.filter((row) => row.alert.deliveryStatus === 'sent').length;
  const failed = rows.filter((row) => row.alert.deliveryStatus === 'failed').length;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Alerts</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {rows.length} alerts · {sent} sent · {failed} failed. Each alert is written by Gemini and
        sent once — the <code className="text-zinc-300">alert_key</code> unique constraint makes a
        duplicate impossible, even if two scans overlap.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">
          No alerts yet. They are sent when a scan finds a new show, when a show materially
          changes, or when an early-bird window is closing within 24 hours.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map(({ alert, artistName, city, priority }) => (
            <article
              key={alert.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <header className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-white">{artistName}</span>
                <span className="text-zinc-500">{city}</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-inset ring-white/10">
                  {TYPE_LABEL[alert.alertType] ?? alert.alertType}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-inset ring-white/10">
                  {priority}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                    STATUS_STYLE[alert.deliveryStatus] ?? STATUS_STYLE.pending
                  }`}
                >
                  {alert.deliveryStatus}
                </span>
                <span className="ml-auto text-xs text-zinc-500">
                  {alert.sentAt ? formatRelative(alert.sentAt) : 'not sent'}
                </span>
              </header>

              {alert.message ? (
                <div
                  className="mt-3 whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-sm text-zinc-300"
                  // The message is Telegram HTML written by Gemini and sanitised
                  // to <b>/<i>/<a>/<code> before it is ever sent or shown.
                  dangerouslySetInnerHTML={{ __html: alert.message }}
                />
              ) : null}

              {alert.error ? (
                <p className="mt-2 text-xs text-rose-300">Error: {alert.error}</p>
              ) : null}
              {alert.sentAt ? (
                <p className="mt-2 text-xs text-zinc-500">{formatIstDateTime(alert.sentAt)}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
