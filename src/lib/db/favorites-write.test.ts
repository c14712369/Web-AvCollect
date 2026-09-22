import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 對一顆臨時 sqlite 檔實測寫入；env 必須在載入 db client 前設好。
const dbFile = path.join(os.tmpdir(), `avcollect-fav-${process.pid}-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.APP_SECRET = 'test-secret-for-favorites';

type Queries = typeof import('./queries');
let q: Queries;

before(async () => {
  const { db } = await import('./client');
  const { sql } = await import('drizzle-orm');
  await db.run(
    sql`CREATE TABLE IF NOT EXISTS favorites (code TEXT PRIMARY KEY, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`
  );
  q = await import('./queries');
  // Windows 下 libsql 可能仍持有檔案握把，清不掉就留給系統 temp 自行回收。
  process.on('exit', () => {
    try {
      fs.rmSync(dbFile, { force: true });
    } catch {
      /* best-effort */
    }
  });
});

// 2026-09-21 事故：單筆收藏動作走「整份覆蓋」，把 favorites 全表洗成 1 筆。
test('加入單筆收藏不會動到其他收藏', async () => {
  await q.setFavorites(['A-1', 'B-2', 'C-3']);
  await q.addFavorite('D-4');
  assert.deepEqual((await q.listFavorites()).sort(), ['A-1', 'B-2', 'C-3', 'D-4']);
});

test('重複加入同一筆不會出錯也不重複', async () => {
  await q.setFavorites(['A-1']);
  await q.addFavorite('A-1');
  assert.deepEqual(await q.listFavorites(), ['A-1']);
});

test('移除單筆收藏只影響該筆', async () => {
  await q.setFavorites(['A-1', 'B-2', 'C-3']);
  await q.removeFavorite('B-2');
  assert.deepEqual((await q.listFavorites()).sort(), ['A-1', 'C-3']);
  await q.removeFavorite('NOT-EXIST');
  assert.deepEqual((await q.listFavorites()).sort(), ['A-1', 'C-3']);
});

// 整份覆蓋是唯一會清空全表的路徑，必須留下可還原的快照。
test('整份覆蓋前會自動備份舊清單', async () => {
  await q.setFavorites(['A-1', 'B-2', 'C-3']);
  await q.setFavorites(['ONLY-ONE']);

  const snapshots = await q.listFavoritesSnapshots();
  assert.ok(snapshots.length >= 1, '應留下至少一份快照');
  assert.deepEqual([...snapshots[0].codes].sort(), ['A-1', 'B-2', 'C-3'], '最新快照應是被覆蓋掉的那份');
  assert.deepEqual(await q.listFavorites(), ['ONLY-ONE']);
});

test('空清單不值得留快照，避免把有用的舊快照擠掉', async () => {
  await q.setFavorites([]);
  const before = await q.listFavoritesSnapshots();
  await q.setFavorites(['X-1']);
  const after = await q.listFavoritesSnapshots();
  assert.equal(after.length, before.length);
});

test('快照只保留最近 20 份', async () => {
  for (let i = 0; i < 25; i++) {
    await q.setFavorites([`SNAP-${i}`]);
  }
  const snapshots = await q.listFavoritesSnapshots();
  assert.equal(snapshots.length, 20);
  // 快照存的是「被覆蓋掉的那份」，所以最後一次寫入 SNAP-24 留下的是 SNAP-23
  assert.deepEqual(snapshots[0].codes, ['SNAP-23'], '最新的快照排在最前');
});
