import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';
import { requireEnv } from '@/lib/env';

/**
 * One HTTP-backed Drizzle client, reused across invocations of a warm lambda.
 * neon-http is a good fit here: short, independent queries, no transactions.
 */
let cached: ReturnType<typeof create> | undefined;

function create() {
  const sql = neon(requireEnv('DATABASE_URL'));
  return drizzle(sql, { schema });
}

export function getDb() {
  if (!cached) cached = create();
  return cached;
}

export const db = new Proxy({} as ReturnType<typeof create>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
