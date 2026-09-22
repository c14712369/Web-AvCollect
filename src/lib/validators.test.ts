import assert from 'node:assert/strict';
import test from 'node:test';
import { favoritesWriteSchema } from './validators';

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
