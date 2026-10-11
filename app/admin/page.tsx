import Link from 'next/link';
import { hasAdminSession } from '@/lib/auth';
import { optionalEnv } from '@/lib/env';
import { Flash } from '@/components/flash';
import { IconBell, IconLogout, IconPulse } from '@/components/icons';
import { loginAction, logoutAction, scanNowAction, sendTestAlertAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

const tile =
  'flex w-full flex-col items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-raised)] px-3 py-4 text-xs font-medium text-[var(--muted)] transition hover:border-white/25 hover:text-white';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const isAdmin = await hasAdminSession();
  const passwordSet = Boolean(optionalEnv('ADMIN_PASSWORD'));
  // Only ever return to a path inside this app.
  const next = params.next?.startsWith('/') ? params.next : '/artists';

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center">
      <div className="panel p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[var(--p1-from)] to-[var(--p1-to)] text-sm">
            ◎
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Admin</h1>
            <p className="text-xs text-[var(--muted)]">
              {isAdmin ? 'You are signed in.' : 'Sign in to run scans and manage artists.'}
            </p>
          </div>
        </div>

        <Flash done={params.done} error={params.error} />

        {isAdmin ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2">
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

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
              <Link href="/artists" className="text-sm text-[var(--accent)] hover:underline">
                Manage artists →
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-sm text-[var(--muted)] transition hover:text-white"
                >
                  <IconLogout className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            <form action={loginAction} className="mt-5 space-y-3">
              <input type="hidden" name="next" value={next} />
              <div>
                <label
                  htmlFor="admin-password"
                  className="mb-1.5 block text-xs uppercase tracking-[0.08em] text-[var(--muted-dim)]"
                >
                  Admin password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg-deep)] px-4 py-2.5 text-sm placeholder:text-[var(--muted-dim)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!passwordSet}
                className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                Sign in
              </button>
              {!passwordSet ? (
                <p className="text-xs text-rose-300">ADMIN_PASSWORD is not set on the server.</p>
              ) : null}
            </form>

            <p className="mt-4 border-t border-[var(--line)] pt-4 text-xs leading-relaxed text-[var(--muted-dim)]">
              Everything else in this app is public and read-only — the dashboard, calendar,
              artists, alert history and scan logs all work without signing in.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
