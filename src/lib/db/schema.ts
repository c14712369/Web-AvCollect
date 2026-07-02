import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const movies = sqliteTable('movies', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  imageUrl: text('image_url').notNull(),
  source: text('source').notNull(),
  category: text('category').notNull(),
  releaseDate: text('release_date'), // ISO YYYY-MM-DD，可為 null
  tags: text('tags'), // JSON 字串 string[]（詳情頁抓的真實類型）；尚未 enrich 或非支援來源為 null
  actress: text('actress'), // 結構化女優名（詳情頁抓的）；舊資料或列表頁來源為 null → fallback regex
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

/**
 * 兩專案 (AvCollect + AvBatch) 共用的動態設定。
 * value 為 JSON 字串。已知 key:
 *   - tracked_tags: string[]          → 主題追蹤白名單
 *   - maker_map: Record<string,string>→ 番號 prefix → 廠商名
 *   - preferred_actresses: string[]   → AvBatch 追蹤女優
 *   - preferred_issuers: string[]     → AvBatch 廠商白名單
 *   - blocked_actresses: string[]
 *   - blocked_issuers: string[]
 */
export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// 預售新片（S1 / Moodyz 等）追蹤表
export const upcomingMovies = sqliteTable('upcoming_movies', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  imageUrl: text('image_url').notNull(),
  source: text('source').notNull(),
  actress: text('actress').notNull(),
  releaseDate: text('release_date'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type MovieRow = typeof movies.$inferSelect;
export type MovieInsert = typeof movies.$inferInsert;
export type FavoriteRow = typeof favorites.$inferSelect;
export type AppConfigRow = typeof appConfig.$inferSelect;
export type UpcomingMovieRow = typeof upcomingMovies.$inferSelect;
export type UpcomingMovieInsert = typeof upcomingMovies.$inferInsert;
