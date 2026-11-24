import { sql } from 'drizzle-orm';
import { db } from './client';
import { viewedMovies } from './schema';

/**
 * 點擊紀錄是自動清理的保護傘之一（點過的片不刪）。
 * 讀寫失敗一律往外拋：讀取失敗若回空集合，清理會把點過的片當成沒點過一起刪掉；
 * 寫入失敗若假裝成功，使用者以為點過的片已受保護，其實沒有。
 */

let ensuredViewedTable = false;
/** 自動確保 viewed_movies 資料表存在。 */
export async function ensureViewedMoviesTable(): Promise<void> {
  if (ensuredViewedTable) return;
  try {
    await db.run(
      sql`CREATE TABLE IF NOT EXISTS viewed_movies (code TEXT PRIMARY KEY, viewed_at INTEGER NOT NULL DEFAULT (unixepoch()))`
    );
    ensuredViewedTable = true;
  } catch (e) {
    // 建表失敗不在這裡擋：接下來的讀寫會因表不存在而拋錯，由呼叫端處理。
    console.warn('[db] ensureViewedMoviesTable warning:', e);
  }
}

/** 記錄使用者點進去瀏覽過的影片；失敗時拋錯。 */
export async function recordMovieView(code: string): Promise<void> {
  if (!code) return;
  await ensureViewedMoviesTable();
  await db
    .insert(viewedMovies)
    .values({ code, viewedAt: new Date() })
    .onConflictDoUpdate({
      target: viewedMovies.code,
      set: { viewedAt: new Date() },
    });
}

/** 取得所有已點擊瀏覽過的番號集合；讀取失敗時拋錯，不回空集合。 */
export async function listViewedCodes(): Promise<Set<string>> {
  await ensureViewedMoviesTable();
  const rows = await db.select({ code: viewedMovies.code }).from(viewedMovies);
  return new Set(rows.map((r) => r.code));
}
