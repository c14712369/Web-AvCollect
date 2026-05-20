import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const movies = sqliteTable('movies', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  imageUrl: text('image_url').notNull(),
  source: text('source').notNull(),
  category: text('category').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const favorites = sqliteTable('favorites', {
  code: text('code').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type MovieRow = typeof movies.$inferSelect;
export type MovieInsert = typeof movies.$inferInsert;
export type FavoriteRow = typeof favorites.$inferSelect;
