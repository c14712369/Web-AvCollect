import assert from 'node:assert/strict';
import test from 'node:test';
import { IMAGE_HOSTS, getImageReferer, isAllowedImageHost } from './image-proxy';

test('fourhoi 封面使用 MissAV AI Referer，避免防盜連 403', () => {
  assert.equal(getImageReferer(new URL('https://fourhoi.com/example/cover-t.jpg')), 'https://missav.ai/');
});

// SSRF 防護：只放行白名單網域與其子網域
test('圖片代理只放行白名單網域與其子網域', () => {
  assert.equal(isAllowedImageHost('fourhoi.com'), true);
  assert.equal(isAllowedImageHost('img.cdn.jable.tv'), true);
  assert.equal(isAllowedImageHost('169.254.169.254'), false);
  assert.equal(isAllowedImageHost('localhost'), false);
  assert.equal(isAllowedImageHost('jable.tv.evil.com'), false);
  assert.equal(isAllowedImageHost('evilfourhoi.com'), false);
});

// 46678d6 / 8f028d8：新增片源圖床時 next.config 與 proxy 白名單各手抄一份，漏改就在 Vercel 破圖。
test('next.config remotePatterns 涵蓋每個白名單網域，且沒有萬用 **', async () => {
  const { default: nextConfig } = await import('../../next.config');
  const patterns = nextConfig.images?.remotePatterns ?? [];
  const hostnames = patterns.map((p) => (p instanceof URL ? p.hostname : p.hostname));
  for (const host of IMAGE_HOSTS) {
    assert.ok(hostnames.includes(host), `${host} 不在 next.config remotePatterns`);
  }
  assert.ok(!hostnames.some((h) => h === '**' || h === '*'), 'remotePatterns 不可用萬用網域');
});

test('每個白名單網域都有對應 Referer', () => {
  assert.equal(getImageReferer(new URL('https://cdn.jable.tv/x.jpg')), 'https://jable.tv/');
  assert.equal(getImageReferer(new URL('https://img.avking.xyz/x.jpg')), 'https://javrate.com/');
  assert.equal(getImageReferer(new URL('https://supjav.com/x.jpg')), 'https://supjav.com/');
  assert.equal(getImageReferer(new URL('https://eightcdn.com/x.jpg')), 'https://missav.com/');
});
