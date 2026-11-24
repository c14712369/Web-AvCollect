import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 對一顆跑過 migration 的臨時 sqlite 檔實測 /api/movies/trash；env 必須在載入 db client 前設好。
const dbFile = path.join(os.tmpdir(), `avcollect-trash-route-${process.pid}-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.APP_SECRET = 'test-secret-for-trash-route';

type Route = typeof import('./route');
let route: Route;
let trashOneMovie: (code: string) => Promise<void>;

before(async () => {
  const { db } = await import('@/lib/db/client');
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { eq } = await import('drizzle-orm');
  const { movies } = await import('@/lib/db/schema');
  const { moveMoviesToTrash } = await import('@/lib/db/movie-trash');
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle', 'migrations') });
  trashOneMovie = async (code) => {
    await db.insert(movies).values({
      code,
      title: `${code} 標題`,
      url: `https://example.com/${code}`,
      imageUrl: `https://img.example.com/${code}.jpg`,
      source: 'Jable',
      category: 'DailyHot',
    });
    const rows = await db.select().from(movies).where(eq(movies.code, code));
    await moveMoviesToTrash(rows, '測試');
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
  route.POST(new Request('http://localhost/api/movies/trash', { method: 'POST', body: JSON.stringify(body) }));

test('還原請求缺番號時回 400', async () => {
  const res = await post({});
  assert.equal(res.status, 400);
  assert.equal((await res.json()).success, false);
});

test('還原回收桶裡沒有的番號回 404', async () => {
  const res = await post({ code: 'NOPE-404' });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).success, false);
});

test('GET 列出回收桶，POST 還原後就不在清單裡', async () => {
  await trashOneMovie('OLD-001');

  const listed = await (await route.GET()).json();
  assert.equal(listed.success, true);
  assert.deepEqual(listed.items.map((m: { code: string }) => m.code), ['OLD-001']);
  assert.equal(listed.retentionDays, 30);

  const restored = await post({ code: 'OLD-001' });
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).success, true);

  assert.deepEqual((await (await route.GET()).json()).items, []);
});
