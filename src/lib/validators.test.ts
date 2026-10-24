import assert from 'node:assert/strict';
import test from 'node:test';
import { configWriteSchema, favoritesWriteSchema } from './validators';

test('收藏寫入接受單筆增刪指令', () => {
  const add = favoritesWriteSchema.safeParse({ op: 'add', code: 'SSIS-001' });
  assert.equal(add.success, true);
  const remove = favoritesWriteSchema.safeParse({ op: 'remove', code: 'SSIS-001' });
  assert.equal(remove.success, true);
});

test('整份覆蓋必須明確宣告 replace，裸陣列不再被接受', () => {
  const replace = favoritesWriteSchema.safeParse({ op: 'replace', codes: ['A-1', 'B-2'] });
  assert.equal(replace.success, true);
  // 舊格式（裸陣列）正是把全表洗掉的那條路徑，必須擋下
  assert.equal(favoritesWriteSchema.safeParse(['A-1']).success, false);
});

test('缺漏或空白的番號一律拒絕', () => {
  assert.equal(favoritesWriteSchema.safeParse({ op: 'add', code: '' }).success, false);
  assert.equal(favoritesWriteSchema.safeParse({ op: 'add' }).success, false);
  assert.equal(favoritesWriteSchema.safeParse({ op: 'nuke', code: 'A-1' }).success, false);
});

// 設定清單同收藏：裸陣列＝整份覆蓋，前端讀取失敗時會把真資料洗成空的。
test('設定清單只接受 add/remove 差異，裸陣列一律拒絕', () => {
  assert.equal(configWriteSchema.safeParse({ preferredActresses: ['只剩我'] }).success, false);
  assert.equal(configWriteSchema.safeParse({ blockedIssuers: ['SSIS'] }).success, false);
  assert.equal(configWriteSchema.safeParse({ trackedTags: { add: ['巨乳'], remove: ['熟女'] } }).success, true);
  assert.equal(configWriteSchema.safeParse({ blockedIssuers: { remove: ['SSIS'] } }).success, true);
  assert.equal(configWriteSchema.safeParse({ trackedTags: { replace: ['A'] } }).success, false);
});

test('makerMap 維持「只補/改傳入的 prefix」語意', () => {
  assert.equal(configWriteSchema.safeParse({ makerMap: { SSIS: 'S1' } }).success, true);
  assert.equal(configWriteSchema.safeParse({ makerMap: { 'bad prefix!': 'S1' } }).success, false);
});
