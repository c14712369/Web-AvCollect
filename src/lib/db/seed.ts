import 'dotenv/config';
import { existsSync } from 'node:fs';
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
  // 只有「檔案不存在」才視為沒有收藏；讀取或解析失敗一律拋錯
  const favoritesRaw: string[] = existsSync(favoritesPath)
    ? JSON.parse(await fs.readFile(favoritesPath, 'utf-8'))
    : [];

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
