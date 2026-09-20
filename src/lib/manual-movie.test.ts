import assert from 'node:assert/strict';
import test from 'node:test';
import { getManualMovieIdentity, shouldUpgradeSource } from './manual-movie';

test('無碼流出 MissAV 連結將番號獨立標記為 -U', () => {
  assert.deepEqual(
    getManualMovieIdentity('https://missav.ws/dm43/midv-946-uncensored-leak'),
    { code: 'MIDV-946-U', source: 'MissAV', isUncensored: true }
  );
});

test('Jable 單片網址可在無法抓取詳情頁時取得標準番號', () => {
  assert.deepEqual(
    getManualMovieIdentity('https://jable.tv/videos/ebwh-354/'),
    { code: 'EBWH-354', source: 'Jable', isUncensored: false }
  );
});

test('只允許較高優先度片源覆蓋既有連結', () => {
  assert.equal(shouldUpgradeSource('MissAV', 'Jable'), true);
  assert.equal(shouldUpgradeSource('Javrate', 'Jable'), true);
  assert.equal(shouldUpgradeSource('Jable', 'MissAV'), false);
});
