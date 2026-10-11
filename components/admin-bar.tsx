import { hasAdminSession } from '@/lib/auth';
import { optionalEnv } from '@/lib/env';
import { IconLogout, IconPulse, IconBell } from '@/components/icons';
import { loginAction, logoutAction, scanNowAction, sendTestAlertAction } from '@/app/actions';

const tile =
  'flex flex-col items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-raised)] px-3 py-3.5 text-[11px] font-medium text-[var(--muted)] transition hover:border-white/20 hover:text-white';

export async function AdminBar() {
  const isAdmin = await hasAdminSession();
  const passwordSet = Boolean(optionalEnv('ADMIN_PASSWORD'));

  if (!isAdmin) {
    return (
      <div className="panel mt-5 p-5">
        <h2 className="text-sm font-semibold">Admin</h2>
        <p className="mt-1 max-w-prose text-sm text-[var(--muted)]">
          Scan now, import artists, connect Spotify and send a test alert need the admin password.
          Everything else here is public and read-only.
        </p>
        <form action={loginAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            name="password"
            placeholder="Admin password"
            autoComplete="current-password"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg-deep)] px-3 py-2 text-sm placeholder:text-[var(--muted-dim)]"
          />
          <button
            type="submit"
            disabled={!passwordSet}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            Sign in
          </button>
          {!passwordSet ? (
            <span className="text-xs text-[var(--muted-dim)]">ADMIN_PASSWORD is not set.</span>
          ) : null}
        </form>
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
          <button type="submit" className={`${tile} w-full`}>
            <IconPulse className="text-[var(--accent)]" />
            Scan now
          </button>
        </form>
        <form action={sendTestAlertAction}>
          <button type="submit" className={`${tile} w-full`}>
            <IconBell className="text-[var(--accent)]" />
            Test alert
          </button>
        </form>
      </div>
    </div>
  );
}
