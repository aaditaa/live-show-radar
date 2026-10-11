import { hasAdminSession } from '@/lib/auth';
import { IconBell } from '@/components/icons';

/** Title row with the admin indicator, mirroring the avatar strip in the reference. */
export async function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const isAdmin = await hasAdminSession();

  return (
    <header className="facets -mx-5 mb-6 flex flex-wrap items-start gap-4 border-b border-[var(--line)] px-5 pb-5 pt-1 sm:-mx-8 sm:px-8">
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {action}
        <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)]">
          <IconBell />
        </span>
        <span
          title={isAdmin ? 'Admin session active' : 'Public read-only view'}
          className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold ${
            isAdmin
              ? 'bg-gradient-to-br from-[var(--accent)] to-[#d8482b] text-white'
              : 'border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)]'
          }`}
        >
          {isAdmin ? 'A' : 'K'}
        </span>
      </div>
    </header>
  );
}
