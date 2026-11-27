import assert from 'node:assert/strict';
import test from 'node:test';
import { stripLeadingMovieCode, upgradeImageUrl } from './utils';

test('Javrate 保留可用的原始縮圖網址，不猜測不存在的全尺寸檔', () => {
  const result = upgradeImageUrl(
    'https://picture.avking.xyz/compressed/20260919/example_thumbnail.webp',
    'Javrate'
  );

  assert.ok(result.includes(encodeURIComponent('example_thumbnail.webp')));
  assert.ok(!result.includes(encodeURIComponent('example.webp')));
});

test('stripLeadingMovieCode 移除標題開頭重複番號，無重複或僅剩番號時保留原標題', () => {
  assert.equal(stripLeadingMovieCode('SMCD-036 校園淫亂太刺激', 'SMCD-036'), '校園淫亂太刺激');
  assert.equal(stripLeadingMovieCode('MIDA-635 オナニー', 'MIDA-635-U'), 'オナニー');
  assert.equal(stripLeadingMovieCode('【CAWD-983】可愛女學生', 'CAWD-983'), '可愛女學生');
  assert.equal(stripLeadingMovieCode('我那嚴肅安靜的繼妹', 'MIDA-635'), '我那嚴肅安靜的繼妹');
  assert.equal(stripLeadingMovieCode('MIDA-635', 'MIDA-635'), 'MIDA-635');
});
