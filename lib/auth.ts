import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { optionalEnv } from '@/lib/env';

export const ADMIN_COOKIE = 'lsr_admin';

/** Constant-time compare that tolerates different lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * The admin cookie never holds the password itself, only a hash of it, so a
 * leaked cookie does not reveal what to type.
 */
export function adminSessionToken(password: string): string {
  return createHash('sha256').update(`live-show-radar:${password}`).digest('hex');
}

export function checkAdminPassword(candidate: string): boolean {
  const expected = optionalEnv('ADMIN_PASSWORD');
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

export async function hasAdminSession(): Promise<boolean> {
  const password = optionalEnv('ADMIN_PASSWORD');
  if (!password) return false;

  const store = await cookies();
  const cookie = store.get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;

  return safeEqual(cookie, adminSessionToken(password));
}

/** `Authorization: Bearer ${CRON_SECRET}` — how the schedulers authenticate. */
export function hasCronBearer(request: Request): boolean {
  const secret = optionalEnv('CRON_SECRET');
  if (!secret) return false;

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;

  return safeEqual(header.slice('Bearer '.length).trim(), secret);
}

/** A scan may be triggered by a scheduler with the bearer token, or by an admin. */
export async function isAuthorisedForScan(request: Request): Promise<boolean> {
  if (hasCronBearer(request)) return true;
  return hasAdminSession();
}
