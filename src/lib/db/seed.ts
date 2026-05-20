import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { movies, favorites } from './schema';

interface JsonMovie {
  code: string;
  title: string;
  url: string;
  imageUrl: string;
  source: string;
  category: string;
}

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client);

  const moviesPath = path.join(process.cwd(), 'src', 'lib', 'data.json');
  const favoritesPath = path.join(process.cwd(), 'src', 'lib', 'favorites.json');

  const moviesRaw = JSON.parse(await fs.readFile(moviesPath, 'utf-8')) as JsonMovie[];
  const favoritesRaw: string[] = await fs
    .readFile(favoritesPath, 'utf-8')
    .then((s) => JSON.parse(s))
    .catch(() => []);

  console.log(`Seeding ${moviesRaw.length} movies and ${favoritesRaw.length} favorites...`);

  for (const m of moviesRaw) {
    await db.insert(movies).values(m).onConflictDoNothing();
  }

  for (const code of favoritesRaw) {
    await db.insert(favorites).values({ code }).onConflictDoNothing();
  }

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
