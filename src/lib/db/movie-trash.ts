import { desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from './client';
import { deletedMovies, movies, viewedMovies, type MovieRow } from './schema';
import { ensureViewedMoviesTable } from './viewed';
import { decidePurge } from '@/lib/cleanup-guard';

/**
 * 自動清理的回收桶（deleted_movies）。
 * 清理不直接刪片：同一個 batch 內「整列搬進回收桶 + 從片庫移除」，要嘛都成功要嘛都不動。
 * 保留 TRASH_RETENTION_DAYS 天，期間可從設定頁還原；過期才永久移除。
 */

export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const CHUNK_SIZE = 100;

export interface TrashedMovie {
  code: string;
  title: string;
  imageUrl: string;
  actress: string | null;
  deletedAt: string; // ISO
  expiresAt: string; // ISO：超過這個時間會被永久移除
}

let ensuredTrashTable = false;
/** 自動確保 deleted_movies 資料表存在（DDL 對齊 schema.ts 的 deletedMovies）。 */
export async function ensureDeletedMoviesTable(): Promise<void> {
  if (ensuredTrashTable) return;
  await db.run(sql`CREATE TABLE IF NOT EXISTS deleted_movies (
    code TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    image_url TEXT NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    release_date TEXT,
    tags TEXT,
    actress TEXT,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER NOT NULL DEFAULT (unixepoch()),
    reason TEXT NOT NULL
  )`);
  ensuredTrashTable = true;
}

/** 把片整列搬進回收桶並從片庫移除；每批在同一個 batch（transaction）內完成。 */
export async function moveMoviesToTrash(rows: MovieRow[], reason: string): Promise<void> {
  if (rows.length === 0) return;
  await ensureDeletedMoviesTable();
  const deletedAt = new Date();
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const codes = chunk.map((r) => r.code);
    await db.batch([
      // 同番號曾被刪過又還原 → 先清掉舊紀錄，回收桶只留最新一次
      db.delete(deletedMovies).where(inArray(deletedMovies.code, codes)),
      db.insert(deletedMovies).values(chunk.map((r) => ({ ...r, deletedAt, reason }))),
      db.delete(movies).where(inArray(movies.code, codes)),
    ]);
  }
}

/** 回收桶內容（新刪的在前）；讀取失敗時拋錯。 */
export async function listTrashedMovies(): Promise<TrashedMovie[]> {
  await ensureDeletedMoviesTable();
  const rows = await db
    .select({
      code: deletedMovies.code,
      title: deletedMovies.title,
      imageUrl: deletedMovies.imageUrl,
      actress: deletedMovies.actress,
      deletedAt: deletedMovies.deletedAt,
    })
    .from(deletedMovies)
    .orderBy(desc(deletedMovies.deletedAt));
  return rows.map((r) => ({
    ...r,
    deletedAt: r.deletedAt.toISOString(),
    expiresAt: new Date(r.deletedAt.getTime() + TRASH_RETENTION_DAYS * DAY_MS).toISOString(),
  }));
}

/**
 * 從回收桶還原一部片：放回片庫（保留原入庫時間）、移出回收桶，並記為已點擊——
 * 使用者主動救回 = 有興趣，否則入庫已滿 14 天的它下一輪清理又會被刪。
 * 回收桶裡沒有這個番號時回傳 false。
 */
export async function restoreTrashedMovie(code: string): Promise<boolean> {
  await ensureDeletedMoviesTable();
  await ensureViewedMoviesTable();
  const [row] = await db.select().from(deletedMovies).where(eq(deletedMovies.code, code));
  if (!row) return false;

  const now = new Date();
  await db.batch([
    db
      .insert(movies)
      .values({
        code: row.code,
        title: row.title,
        url: row.url,
        imageUrl: row.imageUrl,
        source: row.source,
        category: row.category,
        releaseDate: row.releaseDate,
        tags: row.tags,
        actress: row.actress,
        createdAt: row.createdAt,
      })
      .onConflictDoNothing(), // 期間若已被重新入庫，保留片庫現有那筆
    db
      .insert(viewedMovies)
      .values({ code, viewedAt: now })
      .onConflictDoUpdate({ target: viewedMovies.code, set: { viewedAt: now } }),
    db.delete(deletedMovies).where(eq(deletedMovies.code, code)),
  ]);
  return true;
}

/** 永久移除回收桶中超過保留期的項目，回傳移除筆數；過期量異常時中止（見 decidePurge）。 */
export async function purgeExpiredTrash(now = Date.now()): Promise<number> {
  await ensureDeletedMoviesTable();
  const cutoff = new Date(now - TRASH_RETENTION_DAYS * DAY_MS);
  const [{ total, expired }] = await db
    .select({
      total: sql<number>`count(*)`,
      // 用 lt() 讓 cutoff 照欄位的 timestamp 模式轉成秒；直接把 Date 塞進 sql 會綁錯單位、全部算成過期
      expired: sql<number>`coalesce(sum(case when ${lt(deletedMovies.deletedAt, cutoff)} then 1 else 0 end), 0)`,
    })
    .from(deletedMovies);
  const decision = decidePurge({ trashTotal: Number(total), expired: Number(expired) });
  if (!decision.proceed) {
    console.warn(`[trash] 已中止：${decision.reason}`);
    return 0;
  }

  const purged = await db
    .delete(deletedMovies)
    .where(lt(deletedMovies.deletedAt, cutoff))
    .returning({ code: deletedMovies.code });
  if (purged.length > 0) {
    console.log(
      `[trash] 永久移除 ${purged.length} 部超過 ${TRASH_RETENTION_DAYS} 天的回收桶項目：${purged.map((p) => p.code).join(', ')}`
    );
  }
  return purged.length;
}
