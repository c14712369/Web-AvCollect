import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldFetchUpcoming } from './interaction-performance';

test('預售資料在閒置時預抓，使用者提前點擊時也立即抓取', () => {
  assert.equal(shouldFetchUpcoming(false, false), false);
  assert.equal(shouldFetchUpcoming(true, false), true);
  assert.equal(shouldFetchUpcoming(false, true), true);
});
