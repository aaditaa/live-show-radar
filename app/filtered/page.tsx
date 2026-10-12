import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { rejections } from '@/db/schema';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { RejectionList } from '@/components/rejection-list';

export const dynamic = 'force-dynamic';

const REASONS = [
  ['not_a_show_announcement', 'Not a show announcement'],
  ['not_india', 'Not in India'],
  ['low_confidence', 'Wrong or uncertain artist'],
  ['past_event', 'Already happened'],
  ['no_city', 'No city given'],
  ['unknown_artist', 'Not on the list'],
] as const;

export default async function FilteredPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const valid = REASONS.some(([key]) => key === params.reason);
  const reason = valid ? params.reason : undefined;

  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(rejections)
      .where(reason ? eq(rejections.reason, reason) : undefined)
      .orderBy(desc(rejections.createdAt))
      .limit(60),
    db
      .select({ reason: rejections.reason, n: sql<number>`count(*)::int` })
      .from(rejections)
      .groupBy(rejections.reason),
  ]);

  const byReason = new Map(counts.map((row) => [row.reason, row.n]));
  const total = counts.reduce((sum, row) => sum + row.n, 0);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition ${
      active
        ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
        : 'border-[var(--line)] bg-[var(--panel-raised)] text-[var(--muted)] hover:border-white/25 hover:text-white'
    }`;

  return (
    <>
      <PageHeader
        title="Filtered out"
        subtitle={`${total} candidates refused. Finding a concert announcement is easy; telling a real India show apart from a tribute act, a foreign tour date or a namesake is the part that needs the model. Every refusal is kept with the quote it was judged on.`}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/filtered" className={chip(!reason)}>
          All · {total}
        </Link>
        {REASONS.map(([key, label]) => {
          const n = byReason.get(key) ?? 0;
          if (n === 0) return null;
          return (
            <Link key={key} href={`/filtered?reason=${key}`} className={chip(reason === key)}>
              {label} · {n}
            </Link>
          );
        })}
      </div>

      <RejectionList rows={rows} />

      {rows.length === 60 ? (
        <p className="mt-3 text-xs text-[var(--muted-dim)]">
          Showing the 60 most recent.
        </p>
      ) : null}
    </>
  );
}
