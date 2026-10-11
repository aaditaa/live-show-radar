import { hasAdminSession } from '@/lib/auth';
import { optionalEnv } from '@/lib/env';
import {
  loginAction,
  logoutAction,
  scanNowAction,
  sendTestAlertAction,
} from '@/app/actions';

const button =
  'rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/30 disabled:opacity-40';

export async function AdminBar() {
  const isAdmin = await hasAdminSession();
  const passwordSet = Boolean(optionalEnv('ADMIN_PASSWORD'));

  if (!isAdmin) {
    return (
      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm text-zinc-400">
          Admin actions (scan now, import artists, connect Spotify, send a test alert) need the
          admin password. Everything else on this site is public and read-only.
        </p>
        <form action={loginAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            name="password"
            placeholder="Admin password"
            autoComplete="current-password"
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
          />
          <button type="submit" className={button} disabled={!passwordSet}>
            Sign in
          </button>
          {!passwordSet ? (
            <span className="text-xs text-zinc-500">ADMIN_PASSWORD is not set on the server.</span>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
      <span className="mr-2 text-sm font-medium text-emerald-300">Admin</span>
      <form action={scanNowAction}>
        <button type="submit" className={button}>
          Scan now
        </button>
      </form>
      <form action={sendTestAlertAction}>
        <button type="submit" className={button}>
          Send test alert
        </button>
      </form>
      <form action={logoutAction} className="ml-auto">
        <button type="submit" className={button}>
          Sign out
        </button>
      </form>
    </div>
  );
}
