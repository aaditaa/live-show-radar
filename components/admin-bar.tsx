import Link from 'next/link';
import { hasAdminSession } from '@/lib/auth';
import { IconBell, IconLogout, IconPulse } from '@/components/icons';
import { logoutAction, scanNowAction, sendTestAlertAction } from '@/app/actions';

const tile =
  'flex w-full flex-col items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-raised)] px-3 py-3.5 text-[11px] font-medium text-[var(--muted)] transition hover:border-white/25 hover:text-white';

/**
 * Signed in: the admin actions. Signed out: a pointer to the sign-in page,
 * rather than a password field dropped into the middle of a public page.
 */
export async function AdminBar() {
  const isAdmin = await hasAdminSession();

  if (!isAdmin) {
    return (
      <div className="panel mt-5 flex flex-wrap items-center gap-3 p-5">
        <p className="text-sm text-[var(--muted)]">Your session has ended.</p>
        <Link
          href="/admin?next=%2Fartists"
          className="ml-auto rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
        >
          Sign in again
        </Link>
      </div>
    );
  }

  return (
    <div className="panel mt-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
          Admin session
        </h2>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition hover:text-white"
          >
            <IconLogout className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <form action={scanNowAction}>
          <button type="submit" className={tile}>
            <IconPulse className="text-[var(--accent)]" />
            Scan now
          </button>
        </form>
        <form action={sendTestAlertAction}>
          <button type="submit" className={tile}>
            <IconBell className="text-[var(--accent)]" />
            Test alert
          </button>
        </form>
      </div>
    </div>
  );
}
