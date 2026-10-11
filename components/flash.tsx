const ERROR_COPY: Record<string, string> = {
  admin_required: 'Sign in with the admin password first.',
  bad_password: 'That password did not match ADMIN_PASSWORD.',
  spotify_not_configured: 'SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set on the server.',
  state_mismatch: 'The Spotify callback did not match the request this app started. Try again.',
  missing_code: 'Spotify did not return an authorization code.',
  access_denied: 'You declined the Spotify permission request.',
  no_user: 'No user row exists yet. Run npm run db:seed.',
};

/** Shows the outcome of an admin action, success or failure, in plain language. */
export function Flash({ done, error }: { done?: string; error?: string }) {
  if (!done && !error) return null;

  if (error) {
    return (
      <p className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-200">
        {ERROR_COPY[error] ?? error}
      </p>
    );
  }

  return (
    <p className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-300">
      {done}
    </p>
  );
}
