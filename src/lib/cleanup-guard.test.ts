import assert from 'node:assert/strict';
import test from 'node:test';
import { decideCleanup } from './cleanup-guard';

test('日常小量清理照常放行', () => {
  assert.deepEqual(decideCleanup({ totalMovies: 1005, favoritesCount: 42, plannedDeletions: 8 }), {
    proceed: true,
  });
});

// 2026-09-21 事故後的實況：收藏被洗掉，老片瞬間失去「已收藏」保護傘
test('收藏清單為空時不准刪片：保護訊號可能已遺失', () => {
  const d = decideCleanup({ totalMovies: 1005, favoritesCount: 0, plannedDeletions: 8 });
  assert.equal(d.proceed, false);
  assert.match(d.proceed === false ? d.reason : '', /收藏/);
});

test('全新的小資料庫沒有收藏也能正常清理', () => {
  assert.deepEqual(decideCleanup({ totalMovies: 12, favoritesCount: 0, plannedDeletions: 3 }), {
    proceed: true,
  });
});

test('單次刪除量超過全庫兩成時中止，等人確認', () => {
  const d = decideCleanup({ totalMovies: 1005, favoritesCount: 42, plannedDeletions: 700 });
  assert.equal(d.proceed, false);
  assert.match(d.proceed === false ? d.reason : '', /700/);
});

test('小資料庫允許固定額度，不被比例卡死', () => {
  // 20 部的庫刪 5 部＝25%，超過比例但在固定額度內，屬正常汰換
  assert.deepEqual(decideCleanup({ totalMovies: 20, favoritesCount: 3, plannedDeletions: 5 }), {
    proceed: true,
  });
});

test('沒有要刪的東西一律放行', () => {
  assert.deepEqual(decideCleanup({ totalMovies: 1005, favoritesCount: 0, plannedDeletions: 0 }), {
    proceed: true,
  });
});
