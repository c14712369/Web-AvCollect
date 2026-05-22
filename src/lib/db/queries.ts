import { desc, eq } from 'drizzle-orm';
import { db } from './client';
import { movies, favorites, type MovieInsert } from './schema';
import { extractMaker, extractThemes, extractActress } from '@/lib/metadata';
import { getConfig } from '@/lib/config';
import type { Movie } from '@/types/av';

const enrich = (row: typeof movies.$inferSelect): Movie => ({
  code: row.code,
  title: row.title,
  url: row.url,
  imageUrl: row.imageUrl,
  source: row.source,
  category: row.category,
  releaseDate: row.releaseDate ?? null,
  maker: extractMaker(row.code),
  themes: extractThemes(row.title),
  actress: extractActress(row.title),
});

export const listMovies = async (): Promise<Movie[]> => {
  await getConfig();
  const rows = await db
    .select()
    .from(movies)
    .orderBy(desc(movies.createdAt));
  return rows.map(enrich);
};

export const insertMovie = async (data: MovieInsert): Promise<Movie | null> => {
  await getConfig();
  const exists = await db
    .select()
    .from(movies)
    .where(eq(movies.code, data.code))
    .limit(1);
  if (exists.length > 0) return null;
  await db.insert(movies).values(data);
  const inserted = await db
    .select()
    .from(movies)
    .where(eq(movies.code, data.code))
    .limit(1);
  return inserted[0] ? enrich(inserted[0]) : null;
};

export const listFavorites = async (): Promise<string[]> => {
  const rows = await db.select({ code: favorites.code }).from(favorites);
  return rows.map((r) => r.code);
};

export const setFavorites = async (codes: string[]): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.delete(favorites);
    if (codes.length === 0) return;
    await tx
      .insert(favorites)
      .values(codes.map((code) => ({ code })));
  });
};

export const deleteMovie = async (code: string): Promise<boolean> => {
  await db.delete(movies).where(eq(movies.code, code));
  return true;
};
