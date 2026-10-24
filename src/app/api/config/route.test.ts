import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 對一顆跑過 migration 的臨時 sqlite 檔實測 POST /api/config；env 必須在載入 db client 前設好。
const dbFile = path.join(os.tmpdir(), `avcollect-config-route-${process.pid}-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.APP_SECRET = 'test-secret-for-config-route';

type Route = typeof import('./route');
let route: Route;
let readList: (key: string) => Promise<unknown>;
let writeRaw: (key: string, value: string) => Promise<void>;

before(async () => {
  const { db } = await import('@/lib/db/client');
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { eq } = await import('drizzle-orm');
  const { appConfig } = await import('@/lib/db/schema');
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle', 'migrations') });
  readList = async (key) => {
    const rows = await db.select().from(appConfig).where(eq(appConfig.key, key));
    return rows[0] ? JSON.parse(rows[0].value) : undefined;
  };
  writeRaw = async (key, value) => {
    await db.insert(appConfig).values({ key, value }).onConflictDoUpdate({ target: appConfig.key, set: { value } });
  };
  route = await import('./route');
  // Windows 下 libsql 可能仍持有檔案握把，清不掉就留給系統 temp 自行回收。
  process.on('exit', () => {
    try {
      fs.rmSync(dbFile, { force: true });
    } catch {
      /* best-effort */
    }
  });
});

const post = (body: unknown) =>
  route.POST(new Request('http://localhost/api/config', { method: 'POST', body: JSON.stringify(body) }));

// 重現收藏事故的設定版：前端讀取失敗拿到空清單，加一位女優就送出 [新女優] 覆蓋整份。
test('送整份清單會被拒絕，DB 既有喜愛女優不受影響', async () => {
  await writeRaw('preferred_actresses', JSON.stringify(['三上悠亞', '河北彩花']));
  const res = await post({ preferredActresses: ['新女優'] });
  assert.equal(res.status, 400);
  assert.deepEqual(await readList('preferred_actresses'), ['三上悠亞', '河北彩花']);
});

test('差異寫入以 DB 現況為底：新增不洗掉其他項目、移除只動指定項目', async () => {
  await writeRaw('preferred_actresses', JSON.stringify(['三上悠亞', '河北彩花']));
  const res = await post({ preferredActresses: { add: ['新女優'], remove: ['河北彩花'] } });
  assert.equal(res.status, 200);
  assert.deepEqual(await readList('preferred_actresses'), ['三上悠亞', '新女優']);
});

test('封鎖番號差異會轉大寫後再套用', async () => {
  await writeRaw('blocked_issuers', JSON.stringify(['SSIS', 'IPX']));
  const res = await post({ blockedIssuers: { add: ['abw'], remove: ['ipx'] } });
  assert.equal(res.status, 200);
  assert.deepEqual(await readList('blocked_issuers'), ['SSIS', 'ABW']);
});

test('設定讀不到時 makerMap 合併中止，不會把 maker_map 洗成只剩傳入的一筆', async () => {
  await writeRaw('maker_map', JSON.stringify({ SSIS: 'S1', IPX: 'IdeaPocket' }));
  await writeRaw('tracked_tags', '{壞掉'); // 讓 getConfig 讀取失敗
  const res = await post({ makerMap: { ABW: 'Prestige' } });
  assert.equal(res.status, 500);
  assert.deepEqual(await readList('maker_map'), { SSIS: 'S1', IPX: 'IdeaPocket' });
  await writeRaw('tracked_tags', '[]');
});
