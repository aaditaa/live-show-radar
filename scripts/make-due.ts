import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { artists } from '../db/schema';

/**
 * Dev utility: make every artist due for a check right now, so you can run
 * another scan without waiting out the 2 h / 6 h schedule. Never called by the
 * app itself.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (put it in .env.local)');

  const db = drizzle(neon(url));
  const updated = await db
    .update(artists)
    .set({ nextCheckAt: sql`now()` })
    .returning({ id: artists.id });

  console.log(`${updated.length} artists are now due for a check.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
