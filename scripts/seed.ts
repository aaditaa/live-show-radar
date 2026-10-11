import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { eq } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { artists, users } from '../db/schema';
import { parseDemoArtists } from '../lib/demo-artists';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (put it in .env.local)');
  const db = drizzle(neon(url));

  // Karan is the single user. Look first so re-seeding never duplicates him.
  const existing = await db.select().from(users).where(eq(users.name, 'Karan')).limit(1);

  const user =
    existing[0] ??
    (await db.insert(users).values({ name: 'Karan', homeCity: 'Bengaluru' }).returning())[0];

  if (!user) throw new Error('Could not create or find the user Karan');

  const rows = parseDemoArtists();

  // Seeded artists are stored as 'manual': they behave exactly like an artist
  // typed into the import box, and a Spotify sync never touches them.
  const inserted = await db
    .insert(artists)
    .values(
      rows.map((row) => ({
        userId: user.id,
        name: row.name,
        aliases: row.aliases,
        source: 'manual' as const,
        isStarred: row.starred,
      })),
    )
    .onConflictDoNothing()
    .returning({ name: artists.name });

  console.log(`User: ${user.name} (home city ${user.homeCity})`);
  console.log(
    `Demo artists inserted: ${inserted.length} of ${rows.length} (rest already present)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
