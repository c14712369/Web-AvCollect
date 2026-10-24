import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 對一顆臨時 sqlite 檔實測讀取；env 必須在載入 db client 前設好。
const dbFile = path.join(os.tmpdir(), `avcollect-config-${process.pid}-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.APP_SECRET = 'test-secret-for-config';

type Config = typeof import('./config');
type Db = typeof import('./db/client');
let config: Config;
let db: Db['db'];
let sql: typeof import('drizzle-orm').sql;

before(async () => {
  ({ db } = await import('./db/client'));
  ({ sql } = await import('drizzle-orm'));
  config = await import('./config');
  // Windows 下 libsql 可能仍持有檔案握把，清不掉就留給系統 temp 自行回收。
  process.on('exit', () => {
    try {
      fs.rmSync(dbFile, { force: true });
    } catch {
      /* best-effort */
    }
  });
});

test('設定讀取失敗必須拋錯，不可回傳空設定（下一次寫入會把真資料洗掉）', async () => {
  // 尚未建 app_config 表 → 查詢失敗
  await assert.rejects(config.getConfig());
});

test('設定讀取成功時回傳 DB 內容，缺的 key 才用空預設', async () => {
  await db.run(
    sql`CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER DEFAULT (unixepoch()) NOT NULL)`
  );
  await db.run(sql`INSERT OR REPLACE INTO app_config (key, value) VALUES ('preferred_actresses', '["三上悠亞"]')`);
  await db.run(sql`INSERT OR REPLACE INTO app_config (key, value) VALUES ('maker_map', '{"SSIS":"S1"}')`);

  const cfg = await config.getConfig();
  assert.deepEqual(cfg.preferredActresses, ['三上悠亞']);
  assert.deepEqual(cfg.makerMap, { SSIS: 'S1' });
  assert.deepEqual(cfg.trackedTags, []);
});

test('設定值不是合法 JSON 時拋錯，不可默默當成空值', async () => {
  await db.run(sql`INSERT OR REPLACE INTO app_config (key, value) VALUES ('maker_map', '{壞掉')`);
  await assert.rejects(config.getConfig(), /maker_map/);
});
