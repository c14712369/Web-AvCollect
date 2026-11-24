import assert from 'node:assert/strict';
import test, { before, beforeEach } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 對一顆臨時 sqlite 檔實跑自動清理；env 必須在載入 db client 前設好。
const dbFile = path.join(os.tmpdir(), `avcollect-cleanup-${process.pid}-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.APP_SECRET = 'test-secret-for-cleanup';

type Queries = typeof import('./queries');
let q: Queries;
let db: typeof import('./client')['db'];
let sql: typeof import('drizzle-orm').sql;

const DAY = 24 * 60 * 60;
const nowSec = () => Math.floor(Date.now() / 1000);

const VIEWED_DDL = `CREATE TABLE IF NOT EXISTS viewed_movies (code TEXT PRIMARY KEY, viewed_at INTEGER NOT NULL DEFAULT (unixepoch()))`;

/** 塞一部入庫 ageDays 天的片（預設非喜愛女優、非手動新增）。 */
const seedMovie = async (code: string, ageDays: number, extra: { category?: string; title?: string } = {}) => {
  await db.run(
    sql`INSERT INTO movies (code, title, url, image_url, source, category, release_date, tags, actress, created_at)
        VALUES (${code}, ${extra.title ?? `${code} 標題`}, ${`https://example.com/${code}`}, ${`https://img.example.com/${code}.jpg`},
                'Jable', ${extra.category ?? 'DailyHot'}, '2026-01-01', '["巨乳"]', '路人女優', ${nowSec() - ageDays * DAY})`
  );
};

const movieCodes = async (): Promise<string[]> => {
  const res = await db.all<{ code: string }>(sql`SELECT code FROM movies ORDER BY code`);
  return res.map((r) => r.code);
};

before(async () => {
  ({ db } = await import('./client'));
  ({ sql } = await import('drizzle-orm'));
  q = await import('./queries');
  await db.run(sql`CREATE TABLE movies (
    code TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, image_url TEXT NOT NULL,
    source TEXT NOT NULL, category TEXT NOT NULL, release_date TEXT, tags TEXT, actress TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL)`);
  await db.run(sql`CREATE TABLE favorites (code TEXT PRIMARY KEY NOT NULL, created_at INTEGER DEFAULT (unixepoch()) NOT NULL)`);
  await db.run(sql`CREATE TABLE app_config (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER DEFAULT (unixepoch()) NOT NULL)`);
  await db.run(sql`INSERT INTO app_config (key, value) VALUES ('preferred_actresses', '["三上悠亞"]')`);
  // Windows 下 libsql 可能仍持有檔案握把，清不掉就留給系統 temp 自行回收。
  process.on('exit', () => {
    try {
      fs.rmSync(dbFile, { force: true });
    } catch {
      /* best-effort */
    }
  });
});

beforeEach(async () => {
  await db.run(sql`DELETE FROM movies`);
  await db.run(sql`DELETE FROM favorites`);
  await db.run(sql.raw(VIEWED_DDL));
  await db.run(sql`DELETE FROM viewed_movies`);
  const trashTable = await db.all(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deleted_movies'`);
  if (trashTable.length > 0) await db.run(sql`DELETE FROM deleted_movies`);
  // 收藏 / 點擊紀錄都要有東西，否則安全閘會以「保護訊號遺失」中止
  await db.run(sql`INSERT INTO favorites (code) VALUES ('FAV-001')`);
  await db.run(sql`INSERT INTO viewed_movies (code) VALUES ('SEEN-001')`);
});

test('點擊紀錄讀取失敗必須拋錯，不可回傳空集合（會讓點過的片全部失去保護）', async () => {
  await q.listViewedCodes(); // 確保表已建過，之後不會再自動重建
  await db.run(sql`DROP TABLE viewed_movies`);
  await assert.rejects(q.listViewedCodes());
});

test('點擊紀錄寫入失敗必須拋錯，讓 API 回 5xx 而不是假裝成功', async () => {
  await q.listViewedCodes();
  await db.run(sql`DROP TABLE viewed_movies`);
  await assert.rejects(q.recordMovieView('ABC-123'));
});

test('點擊紀錄讀不到時自動清理整次中止，一部都不刪', async () => {
  await seedMovie('SEEN-001', 30);
  await seedMovie('OLD-001', 30);
  await q.listViewedCodes();
  await db.run(sql`DROP TABLE viewed_movies`);

  assert.equal(await q.cleanupStaleUnviewedMovies(true), 0);
  assert.deepEqual(await movieCodes(), ['OLD-001', 'SEEN-001']);
});

// ── 回收桶：自動清理不直接刪，先整列搬進 deleted_movies，保留 30 天可還原 ──
const loadTrash = () => import('./movie-trash');

const seedProtectedLibrary = async () => {
  await seedMovie('OLD-001', 30); // 唯一該被清掉的
  await seedMovie('SEEN-001', 30); // 點過
  await seedMovie('FAV-001', 30); // 收藏
  await seedMovie('MANUAL-001', 30, { category: '使用者新增' });
  await seedMovie('PREF-001', 30, { title: 'PREF-001 三上悠亞 新作' }); // 喜愛女優
  await seedMovie('FRESH-001', 3); // 入庫未滿 14 天
};

test('自動清理把片整列搬進回收桶，欄位完整、原入庫時間保留', async () => {
  const trash = await loadTrash();
  await seedProtectedLibrary();
  const [before] = await db.all<{ created_at: number }>(sql`SELECT created_at FROM movies WHERE code = 'OLD-001'`);

  assert.equal(await q.cleanupStaleUnviewedMovies(true), 1);
  assert.deepEqual(await movieCodes(), ['FAV-001', 'FRESH-001', 'MANUAL-001', 'PREF-001', 'SEEN-001']);

  const items = await trash.listTrashedMovies();
  assert.equal(items.length, 1);
  const [row] = await db.all<Record<string, unknown>>(sql`SELECT * FROM deleted_movies WHERE code = 'OLD-001'`);
  assert.equal(row.title, 'OLD-001 標題');
  assert.equal(row.url, 'https://example.com/OLD-001');
  assert.equal(row.image_url, 'https://img.example.com/OLD-001.jpg');
  assert.equal(row.tags, '["巨乳"]');
  assert.equal(row.actress, '路人女優');
  assert.equal(row.created_at, before.created_at);
  assert.ok(String(row.reason).length > 0);
});

test('從回收桶還原：回到片庫、離開回收桶，且記為已點擊，下次清理不會再刪', async () => {
  const trash = await loadTrash();
  await seedProtectedLibrary();
  await q.cleanupStaleUnviewedMovies(true);

  assert.equal(await trash.restoreTrashedMovie('OLD-001'), true);
  assert.ok((await movieCodes()).includes('OLD-001'));
  assert.deepEqual(await trash.listTrashedMovies(), []);
  assert.ok((await q.listViewedCodes()).has('OLD-001'));

  assert.equal(await q.cleanupStaleUnviewedMovies(true), 0);
  assert.ok((await movieCodes()).includes('OLD-001'));
});

test('還原回收桶裡沒有的番號回傳 false，不動片庫', async () => {
  const trash = await loadTrash();
  await seedMovie('OLD-001', 30);
  assert.equal(await trash.restoreTrashedMovie('NOPE-404'), false);
  assert.deepEqual(await movieCodes(), ['OLD-001']);
});

test('回收桶超過 30 天的項目永久移除，30 天內的保留', async () => {
  const trash = await loadTrash();
  await trash.listTrashedMovies(); // 確保表存在
  for (const [code, ageDays] of [['EXPIRED-001', 31], ['KEEP-001', 29]] as const) {
    await db.run(
      sql`INSERT INTO deleted_movies (code, title, url, image_url, source, category, created_at, deleted_at, reason)
          VALUES (${code}, ${code}, 'u', 'i', 'Jable', 'DailyHot', ${nowSec() - 60 * DAY}, ${nowSec() - ageDays * DAY}, '測試')`
    );
  }

  assert.equal(await trash.purgeExpiredTrash(), 1);
  assert.deepEqual((await trash.listTrashedMovies()).map((m) => m.code), ['KEEP-001']);
});

test('回收桶讀取失敗必須拋錯，不可回傳空清單', async () => {
  const trash = await loadTrash();
  await trash.listTrashedMovies();
  await db.run(sql`ALTER TABLE deleted_movies RENAME TO deleted_movies_hidden`);
  try {
    await assert.rejects(trash.listTrashedMovies());
  } finally {
    await db.run(sql`ALTER TABLE deleted_movies_hidden RENAME TO deleted_movies`);
  }
});

test('回收桶寫入失敗時片不可被刪：搬移與刪除同一個 transaction', async () => {
  const trash = await loadTrash();
  await seedMovie('OLD-001', 30);
  await seedMovie('OLD-002', 30);
  await trash.listTrashedMovies(); // 確保表存在
  await db.run(sql`CREATE TRIGGER fail_trash_insert BEFORE INSERT ON deleted_movies BEGIN SELECT RAISE(ABORT, 'trash down'); END`);
  try {
    const rows = await db.all<Record<string, unknown>>(sql`SELECT * FROM movies`);
    const { movies } = await import('./schema');
    const { inArray } = await import('drizzle-orm');
    const full = await db.select().from(movies).where(inArray(movies.code, rows.map((r) => String(r.code))));
    await assert.rejects(trash.moveMoviesToTrash(full, '測試'));
    assert.deepEqual(await movieCodes(), ['OLD-001', 'OLD-002']);
  } finally {
    await db.run(sql`DROP TRIGGER fail_trash_insert`);
  }
});

test('回收桶過半同時過期時不永久移除，一筆都不動', async () => {
  const trash = await loadTrash();
  await trash.listTrashedMovies();
  for (let i = 0; i < 25; i++) {
    const code = `EXPIRED-${String(i).padStart(3, '0')}`;
    await db.run(
      sql`INSERT INTO deleted_movies (code, title, url, image_url, source, category, created_at, deleted_at, reason)
          VALUES (${code}, ${code}, 'u', 'i', 'Jable', 'DailyHot', ${nowSec() - 90 * DAY}, ${nowSec() - 40 * DAY}, '測試')`
    );
  }
  assert.equal(await trash.purgeExpiredTrash(), 0);
  assert.equal((await trash.listTrashedMovies()).length, 25);
});

test('過期量正常時照常永久移除：只清過期的那幾部', async () => {
  const trash = await loadTrash();
  await trash.listTrashedMovies();
  for (let i = 0; i < 30; i++) {
    const code = `T-${String(i).padStart(3, '0')}`;
    const ageDays = i < 10 ? 40 : 1; // 10 部過期、20 部未過期
    await db.run(
      sql`INSERT INTO deleted_movies (code, title, url, image_url, source, category, created_at, deleted_at, reason)
          VALUES (${code}, ${code}, 'u', 'i', 'Jable', 'DailyHot', ${nowSec() - 90 * DAY}, ${nowSec() - ageDays * DAY}, '測試')`
    );
  }
  assert.equal(await trash.purgeExpiredTrash(), 10);
  assert.equal((await trash.listTrashedMovies()).length, 20);
});
