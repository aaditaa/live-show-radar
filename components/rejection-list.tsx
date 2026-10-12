import type { Rejection } from '@/db/schema';
import { formatRelative } from '@/lib/time';

const REASON_LABEL: Record<string, string> = {
  not_a_show_announcement: 'Not a show announcement',
  not_india: 'Not in India',
  low_confidence: 'Not confidently this artist',
  past_event: 'Already happened',
  no_city: 'No city given',
  unknown_artist: 'Not an artist on the list',
};

const REASON_STYLE: Record<string, string> = {
  not_a_show_announcement: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
  not_india: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  low_confidence: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  past_event: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
  no_city: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
  unknown_artist: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
};

/**
 * What the pipeline threw away. The filtering is the part that is hard to
 * believe without seeing it, so the evidence quote is shown verbatim.
 */
export function RejectionList({ rows }: { rows: Rejection[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-dashed border-[var(--line)] px-5 py-6 text-sm text-[var(--muted)]">
        Nothing has been filtered out yet.
      </p>
    );
  }

  return (
    <ul className="panel mt-3 divide-y divide-[var(--line)]">
      {rows.map((row) => (
        <li key={row.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-white">{row.claimedArtist}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                REASON_STYLE[row.reason] ?? REASON_STYLE.not_a_show_announcement
              }`}
            >
              {REASON_LABEL[row.reason] ?? row.reason}
            </span>
            {row.country && row.reason === 'not_india' ? (
              <span className="text-[11px] text-[var(--muted-dim)]">
                {[row.city, row.country].filter(Boolean).join(', ')}
              </span>
            ) : null}
            {row.reason === 'low_confidence' && row.confidence !== null ? (
              <span className="text-[11px] text-[var(--muted-dim)]">
                confidence {Number(row.confidence).toFixed(2)}
              </span>
            ) : null}
            <span className="ml-auto text-[11px] text-[var(--muted-dim)]">
              {formatRelative(row.createdAt)}
            </span>
          </div>
          {row.evidence ? (
            <p className="mt-1.5 line-clamp-2 text-xs italic leading-relaxed text-[var(--muted)]">
              “{row.evidence}”
            </p>
          ) : null}
          {row.sourceUrl ? (
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-block text-[11px] text-[var(--muted-dim)] underline decoration-dotted hover:text-white"
            >
              source
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
