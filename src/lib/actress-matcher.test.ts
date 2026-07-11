import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countActressAppearances, matchActress } from './actress-matcher';

// 收藏限定的女優下拉選項來自收藏片的 actress 欄位切割，
// 因此「同字串自比對」必須恆為 true，否則篩選必定零結果。

test('含全形括號的別名格式可比對（收藏限定下拉案例）', () => {
  assert.equal(matchActress('善場まみ（茉城ねね）', '善場まみ（茉城ねね）'), true);
});

test('U+9632 之後的常用漢字可比對（高、香等）', () => {
  assert.equal(matchActress('高橋聖子', '高橋聖子'), true);
  assert.equal(matchActress('香月りお', '香月りお'), true);
});

test('含片假名長音「ー」的名字可比對', () => {
  assert.equal(matchActress('ローラ', 'ローラ'), true);
});

test('一般 CJK 名字與譯名變體維持可比對（回歸）', () => {
  assert.equal(matchActress('明里紬', '明里つむぎ 主演作品'), true);
  assert.equal(matchActress('三上悠亞', '三上悠亜'), true);
});

test('英文變體維持單字邊界防護（回歸）', () => {
  assert.equal(matchActress('坂道みる', 'featuring miru today'), true);
  assert.equal(matchActress('坂道みる', 'miruku drink'), false);
});

test('目標為空字串時回傳 false（回歸）', () => {
  assert.equal(matchActress('明里紬', ''), false);
});

// 下拉選單計數必須與 matchActress 篩選同一套歸一邏輯，
// 否則會出現「選單顯示 1 部、實際篩出 16 部」的不一致。

test('計數：大小寫不同的同名合併為一個選項，取多數寫法當顯示名', () => {
  assert.deepEqual(
    countActressAppearances(['miru', 'Miru', 'miru']),
    { miru: 3 }
  );
});

test('計數：譯名變體（miru／坂道みる／坂道美琉）合併為同一人', () => {
  const counts = countActressAppearances(['坂道みる', 'miru', '坂道美琉']);
  const entries = Object.entries(counts);
  assert.equal(entries.length, 1);
  assert.equal(entries[0][1], 3);
});

test('計數：不同女優不互相合併', () => {
  assert.deepEqual(
    countActressAppearances(['明里紬', '高橋聖子', '明里紬']),
    { '明里紬': 2, '高橋聖子': 1 }
  );
});

test('計數：多人欄位切割後分別計數，空值忽略', () => {
  assert.deepEqual(
    countActressAppearances(['明里紬 高橋聖子', null, undefined, '', '明里紬']),
    { '明里紬': 2, '高橋聖子': 1 }
  );
});
