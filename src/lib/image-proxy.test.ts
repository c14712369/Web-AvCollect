import assert from 'node:assert/strict';
import test from 'node:test';
import { getImageReferer } from './image-proxy';

test('fourhoi 封面使用 MissAV AI Referer，避免防盜連 403', () => {
  assert.equal(getImageReferer(new URL('https://fourhoi.com/example/cover-t.jpg')), 'https://missav.ai/');
});
