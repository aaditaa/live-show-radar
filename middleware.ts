import { NextResponse, type NextRequest } from 'next/server';

/**
 * Every page requires the admin password.
 *
 * Note this overrides the brief's "public read-only dashboard" requirement:
 * a visitor without the password now sees only the sign-in page. Anyone who
 * should be able to look around needs the password.
 *
 * Exempt paths, and why:
 *  - /admin            the sign-in page itself, or nobody could ever sign in
 *  - /api/scan         the schedulers authenticate with a bearer token
 *  - /api/test-alert   same bearer token
 *  - /api/spotify/*    the OAuth round trip; /login checks the session itself
 */
const PUBLIC_PATHS = ['/admin', '/api/scan', '/api/test-alert', '/api/spotify'];

const ADMIN_COOKIE = 'lsr_admin';

/** Web Crypto, because middleware runs on the edge runtime. */
async function expectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`live-show-radar:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const password = process.env.ADMIN_PASSWORD;
  // With no password configured nobody could ever get in, so fail open rather
  // than bricking the deployment; /admin says the variable is missing.
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (cookie && cookie === (await expectedToken(password))) {
    return NextResponse.next();
  }

  const signIn = new URL('/admin', request.url);
  signIn.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
