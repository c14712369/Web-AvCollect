import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  expectedSessionHash,
  getAuthCookieOptions,
  isValidSession,
  shouldRefreshSessionCookie,
} from '@/lib/auth';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as logoutPOST } from '@/app/api/auth/logout/route';
import { middleware } from '@/middleware';

const TEST_SECRET = 'test-permanent-auth-secret';

async function withProductionEnv<T>(fn: () => Promise<T>): Promise<T> {
  const env = process.env as Record<string, string | undefined>;
  const prevNodeEnv = env.NODE_ENV;
  const prevSecret = env.APP_SECRET;
  env.NODE_ENV = 'production';
  env.APP_SECRET = TEST_SECRET;
  try {
    return await fn();
  } finally {
    if (prevNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = prevNodeEnv;
    if (prevSecret === undefined) delete env.APP_SECRET;
    else env.APP_SECRET = prevSecret;
  }
}

test('AUTH_COOKIE_MAX_AGE 為瀏覽器上限 400 天且共用設定正確', () => {
  assert.equal(AUTH_COOKIE_MAX_AGE, 60 * 60 * 24 * 400);
  const opts = getAuthCookieOptions();
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, 'lax');
  assert.equal(opts.path, '/');
  assert.equal(opts.maxAge, AUTH_COOKIE_MAX_AGE);
  assert.equal(getAuthCookieOptions(0).maxAge, 0);
});

test('isValidSession 只接受對應 APP_SECRET 的雜湊值', async () => {
  const hash = await expectedSessionHash(TEST_SECRET);
  assert.equal(await isValidSession(hash, TEST_SECRET), true);
  assert.equal(await isValidSession('wrong-hash', TEST_SECRET), false);
  assert.equal(await isValidSession(undefined, TEST_SECRET), false);
});

test('shouldRefreshSessionCookie 排除登出與圖片代理路徑', () => {
  assert.equal(shouldRefreshSessionCookie('/'), true);
  assert.equal(shouldRefreshSessionCookie('/api/movies'), true);
  assert.equal(shouldRefreshSessionCookie('/api/auth/logout'), false);
  assert.equal(shouldRefreshSessionCookie('/api/image-proxy'), false);
});

test('POST /api/auth/login 密碼正確時寫入 400 天持久 Cookie，錯誤回 401', async () => {
  await withProductionEnv(async () => {
    const okRes = await loginPOST(
      new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: TEST_SECRET }),
      })
    );
    assert.equal(okRes.status, 200);
    assert.deepEqual(await okRes.json(), { success: true });

    const setCookie = okRes.headers.get('set-cookie') ?? '';
    const expected = await expectedSessionHash(TEST_SECRET);
    assert.ok(setCookie.includes(`${AUTH_COOKIE}=${expected}`));
    assert.ok(setCookie.includes(`Max-Age=${AUTH_COOKIE_MAX_AGE}`));
    assert.ok(setCookie.includes('HttpOnly'));
    assert.ok(setCookie.includes('Secure'));

    const badRes = await loginPOST(
      new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' }),
      })
    );
    assert.equal(badRes.status, 401);
    assert.equal(badRes.headers.get('set-cookie'), null);
  });
});

test('POST /api/auth/logout 會將 Cookie Max-Age 歸零清除', async () => {
  await withProductionEnv(async () => {
    const res = await logoutPOST();
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    assert.ok(setCookie.includes(`${AUTH_COOKIE}=;`));
    assert.ok(setCookie.includes('Max-Age=0'));
  });
});

test('middleware 驗證通過時自動續期 Cookie，登出與圖片代理不重複寫入，未登入則擋下', async () => {
  await withProductionEnv(async () => {
    const hash = await expectedSessionHash(TEST_SECRET);

    const pageRes = await middleware(
      new NextRequest('https://example.com/', {
        headers: { cookie: `${AUTH_COOKIE}=${hash}` },
      })
    );
    assert.equal(pageRes.status, 200);
    const refreshed = pageRes.headers.get('set-cookie') ?? '';
    assert.ok(refreshed.includes(`${AUTH_COOKIE}=${hash}`));
    assert.ok(refreshed.includes(`Max-Age=${AUTH_COOKIE_MAX_AGE}`));

    const logoutPassRes = await middleware(
      new NextRequest('https://example.com/api/auth/logout', {
        method: 'POST',
        headers: { cookie: `${AUTH_COOKIE}=${hash}` },
      })
    );
    assert.equal(logoutPassRes.status, 200);
    assert.equal(logoutPassRes.headers.get('set-cookie'), null);

    const imgPassRes = await middleware(
      new NextRequest('https://example.com/api/image-proxy?url=https://fourhoi.com/a.jpg', {
        headers: { cookie: `${AUTH_COOKIE}=${hash}` },
      })
    );
    assert.equal(imgPassRes.status, 200);
    assert.equal(imgPassRes.headers.get('set-cookie'), null);

    const unauthPageRes = await middleware(new NextRequest('https://example.com/settings'));
    assert.equal(unauthPageRes.status, 307);
    assert.ok((unauthPageRes.headers.get('location') ?? '').includes('/login?from=%2Fsettings'));

    const unauthApiRes = await middleware(new NextRequest('https://example.com/api/movies'));
    assert.equal(unauthApiRes.status, 401);
  });
});
