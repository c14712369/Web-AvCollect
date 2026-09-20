import assert from 'node:assert/strict';
import test from 'node:test';
import { upgradeImageUrl } from './utils';

test('Javrate 保留可用的原始縮圖網址，不猜測不存在的全尺寸檔', () => {
  const result = upgradeImageUrl(
    'https://picture.avking.xyz/compressed/20260919/example_thumbnail.webp',
    'Javrate'
  );

  assert.ok(result.includes(encodeURIComponent('example_thumbnail.webp')));
  assert.ok(!result.includes(encodeURIComponent('example.webp')));
});
