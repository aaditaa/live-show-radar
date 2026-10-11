import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (put it in .env.local)');

  const db = drizzle(neon(url));
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
