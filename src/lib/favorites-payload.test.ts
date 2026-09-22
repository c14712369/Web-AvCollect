import assert from 'node:assert/strict';
import test from 'node:test';
import { applyFavoriteDelta, buildTogglePayload } from './favorites-payload';

// 2026-09-21 事故：toggle 送「整份覆蓋」，在 favorites 尚未載入時把全表洗成 1 筆。
// toggle 一律只能送單筆增刪，永遠不得攜帶完整清單。
test('收藏 toggle 只送單筆增刪指令，不送整份清單', () => {
  assert.deepEqual(buildTogglePayload('SSIS-001', false), { op: 'add', code: 'SSIS-001' });
  assert.deepEqual(buildTogglePayload('SSIS-001', true), { op: 'remove', code: 'SSIS-001' });
});

test('樂觀更新在清單尚未載入時不會抹掉既有收藏', () => {
  // undefined = query 尚未載入或載入失敗：只能新增自己這筆，不得推論成空清單
  assert.deepEqual(applyFavoriteDelta(undefined, { op: 'add', code: 'SSIS-001' }), ['SSIS-001']);
  assert.deepEqual(applyFavoriteDelta(undefined, { op: 'remove', code: 'SSIS-001' }), []);
});

test('樂觀更新沿用既有清單且不重複加入', () => {
  const current = ['A-1', 'B-2'];
  assert.deepEqual(applyFavoriteDelta(current, { op: 'add', code: 'C-3' }), ['A-1', 'B-2', 'C-3']);
  assert.deepEqual(applyFavoriteDelta(current, { op: 'add', code: 'A-1' }), ['A-1', 'B-2']);
  assert.deepEqual(applyFavoriteDelta(current, { op: 'remove', code: 'A-1' }), ['B-2']);
});
