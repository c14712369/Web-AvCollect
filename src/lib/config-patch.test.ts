import assert from 'node:assert/strict';
import test from 'node:test';
import { applyListDelta, diffList, mergeListDelta } from './config-patch';

test('設定清單只送差異：新增與移除各自列出', () => {
  assert.deepEqual(diffList(['A', 'B'], ['A', 'C']), { add: ['C'], remove: ['B'] });
});

test('清單沒變時不送任何指令', () => {
  assert.equal(diffList(['A', 'B'], ['A', 'B']), undefined);
  assert.equal(diffList(['A', 'B'], ['B', 'A']), undefined);
});

// 2026-09-21 收藏事故的設定版：前端以為清單是空的（讀取失敗），加一筆就送出 [X] 覆蓋整份。
// 改送差異後，後端以 DB 現況為底套用，既有項目不會被洗掉。
test('前端底稿是空的時，套用差異也不會洗掉 DB 既有項目', () => {
  const delta = diffList([], ['X']);
  assert.deepEqual(applyListDelta(['A', 'B'], delta ?? {}), ['A', 'B', 'X']);
});

test('套用差異：移除只影響指定項目、新增不重複', () => {
  assert.deepEqual(applyListDelta(['A', 'B', 'C'], { add: ['A', 'D'], remove: ['B', 'NOPE'] }), ['A', 'C', 'D']);
});

test('debounce 期間的多次切換合併成最後意圖', () => {
  const merged = mergeListDelta({ add: ['A'], remove: ['B'] }, { add: ['B'], remove: ['A'] });
  assert.deepEqual(merged, { add: ['B'], remove: ['A'] });
  assert.deepEqual(mergeListDelta(undefined, { add: ['A'] }), { add: ['A'], remove: [] });
});
