import assert from 'node:assert/strict';
import test from 'node:test';
import { pageFromSearchParam, toIsoTimestamp } from './client-state';

test('預售資料的 createdAt 可接受 API 傳回的 ISO 字串與 Date', () => {
  assert.equal(toIsoTimestamp('2026-09-20T03:00:00.000Z'), '2026-09-20T03:00:00.000Z');
  assert.equal(toIsoTimestamp(new Date('2026-09-20T03:00:00.000Z')), '2026-09-20T03:00:00.000Z');
});

test('分頁網址只接受正整數，非法頁碼回到第一頁', () => {
  assert.equal(pageFromSearchParam('4'), 4);
  assert.equal(pageFromSearchParam('0'), 1);
  assert.equal(pageFromSearchParam('four'), 1);
  assert.equal(pageFromSearchParam(null), 1);
});
