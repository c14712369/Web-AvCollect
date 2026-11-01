import assert from 'node:assert/strict';
import test from 'node:test';
import { getFallbackCoverUrl, getManualMovieIdentity, getPlaceholderRepairPatch, isPlaceholderMovie, isUnusableDetailPage, mergeAddedMovie, shouldUpgradeSource } from './manual-movie';

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

test('片源優先級：高畫質優先 ➔ Javrate 無碼 ➔ 同畫質普通有碼 Jable 優先', () => {
  // 1. 同為 720p 普通有碼：Jable 播放順暢度優於 Javrate 與 MissAV
  assert.equal(shouldUpgradeSource({ source: 'Javrate', code: 'MIDA-837' }, { source: 'Jable', code: 'MIDA-837' }), true);
  assert.equal(shouldUpgradeSource({ source: 'MissAV', code: 'MIDA-837' }, { source: 'Jable', code: 'MIDA-837' }), true);
  assert.equal(shouldUpgradeSource({ source: 'Jable', code: 'MIDA-837' }, { source: 'Javrate', code: 'MIDA-837' }), false);

  // 2. 劇情用語「愛液流出/体液流出」不誤判為無碼，普通有碼仍應轉至 Jable
  assert.equal(
    shouldUpgradeSource(
      { source: 'Javrate', code: 'FNS-191', title: '愛液流出絕頂痙攣 楓富愛' },
      { source: 'Jable', code: 'FNS-191' }
    ),
    true
  );

  // 3. Javrate 無碼（天然無碼、-U、標題含無碼）：優先度高於 Jable 有碼
  assert.equal(
    shouldUpgradeSource(
      { source: 'Javrate', code: 'FC2-PPV-1234567' },
      { source: 'Jable', code: 'FC2-PPV-1234567' }
    ),
    false
  );
  assert.equal(
    shouldUpgradeSource(
      { source: 'Javrate', code: 'MIDA-837-U' },
      { source: 'Jable', code: 'MIDA-837' }
    ),
    false
  );
  assert.equal(
    shouldUpgradeSource(
      { source: 'Javrate', code: 'FNS-272', title: 'FNS-272 無碼破解流出' },
      { source: 'Jable', code: 'FNS-272' }
    ),
    false
  );

  // 4. 高畫質碾壓：1080p / 4K 優於 720p
  assert.equal(
    shouldUpgradeSource(
      { source: 'Jable', code: 'MIDA-837' },
      { source: 'MissAV', code: 'MIDA-837', title: 'MIDA-837 [1080p]' }
    ),
    true
  );
  assert.equal(
    shouldUpgradeSource(
      { source: 'MissAV', code: 'MIDA-837', title: 'MIDA-837 [1080p]' },
      { source: 'Jable', code: 'MIDA-837' }
    ),
    false
  );
  assert.equal(
    shouldUpgradeSource(
      { source: 'MissAV', code: 'MIDA-837', title: 'MIDA-837 [1080p]' },
      { source: 'Jable', code: 'MIDA-837', title: 'MIDA-837 4K' }
    ),
    true
  );

  // 5. 未知來源即使標註 1080p 也絕不覆蓋已知來源（防止惡意偽裝）
  assert.equal(
    shouldUpgradeSource(
      { source: 'Jable', code: 'MIDA-837' },
      { source: 'UnknownSite', code: 'MIDA-837', title: 'MIDA-837 1080p' }
    ),
    false
  );
});

test('詳情頁被擋時，封面備援改用 MissAV 現役 CDN（fourhoi），無碼流出保留完整 slug', () => {
  assert.equal(
    getFallbackCoverUrl('https://missav.ai/apgh-056-uncensored-leak', 'APGH-056-U'),
    'https://fourhoi.com/apgh-056-uncensored-leak/cover-n.jpg'
  );
  assert.equal(
    getFallbackCoverUrl('https://missav.ws/dm43/simp-020', 'SIMP-020'),
    'https://fourhoi.com/simp-020/cover-n.jpg'
  );
  assert.equal(
    getFallbackCoverUrl('https://jable.tv/videos/ipzz-751/', 'IPZZ-751'),
    'https://fourhoi.com/ipzz-751/cover-n.jpg'
  );
  assert.equal(getFallbackCoverUrl('https://jable.tv/videos/x/', 'UNKNOWN'), '');
});

test('標題等於番號或封面空白/死鏈即視為待補資料的佔位片', () => {
  assert.equal(isPlaceholderMovie({ code: 'SIMP-020', title: 'SIMP-020', imageUrl: 'https://fourhoi.com/simp-020/cover-n.jpg' }), true);
  assert.equal(isPlaceholderMovie({ code: 'IPZZ-751', title: 'IPZZ-751 同學會', imageUrl: '' }), true);
  assert.equal(isPlaceholderMovie({ code: 'KNMB-115', title: 'KNMB-115 標題', imageUrl: 'https://sixyik.com/knmb-115/cover-n.jpg' }), true);
  assert.equal(isPlaceholderMovie({ code: 'IPZZ-751', title: 'IPZZ-751 同學會', imageUrl: 'https://assets-cdn.jable.tv/x/preview.jpg' }), false);
});

test('詳情頁 404/403/CF 挑戰頁都視為抓不到 metadata，不可把錯誤頁標題存進 DB', () => {
  assert.equal(isUnusableDetailPage(404, '404 Not Found'), true);
  assert.equal(isUnusableDetailPage(403, 'IPZZ-751 xxx'), true);
  assert.equal(isUnusableDetailPage(200, 'Just a moment...'), true);
  assert.equal(isUnusableDetailPage(200, 'IPZZ-751 同學會'), false);
  assert.equal(isPlaceholderMovie({ code: 'DASS-011', title: '404 Not Found', imageUrl: 'https://fourhoi.com/dass-011/cover-n.jpg' }), true);
});

test('補資料後以番號取代快取中的舊卡片，不重複插入', () => {
  const old = [{ code: 'A-1', title: 'A-1' }, { code: 'B-2', title: 'B' }];
  assert.deepEqual(mergeAddedMovie(old, { code: 'A-1', title: 'A-1 新標題' }), [{ code: 'A-1', title: 'A-1 新標題' }, { code: 'B-2', title: 'B' }]);
  assert.deepEqual(mergeAddedMovie(old, { code: 'C-3', title: 'C' }).map((m) => m.code), ['C-3', 'A-1', 'B-2']);
  assert.deepEqual(mergeAddedMovie(undefined, { code: 'C-3', title: 'C' }), [{ code: 'C-3', title: 'C' }]);
});

test('佔位片補資料：詳情頁仍被擋時至少補上可用封面', () => {
  const base = { code: 'KNMB-115', url: 'https://missav.ai/knmb-115', source: 'MissAV' };
  assert.deepEqual(
    getPlaceholderRepairPatch(
      { ...base, title: 'KNMB-115', imageUrl: 'https://sixyik.com/knmb-115/cover-n.jpg' },
      { ...base, title: 'KNMB-115', imageUrl: 'https://fourhoi.com/knmb-115/cover-n.jpg' }
    ),
    { imageUrl: 'https://fourhoi.com/knmb-115/cover-n.jpg' }
  );
});

test('佔位片補資料：抓到真標題就補標題，已補好的片不再動', () => {
  const base = { code: 'IPZZ-751', url: 'https://jable.tv/videos/ipzz-751/', source: 'Jable' };
  assert.deepEqual(
    getPlaceholderRepairPatch(
      { ...base, title: 'IPZZ-751', imageUrl: '' },
      { ...base, title: 'IPZZ-751 同學會', imageUrl: 'https://assets-cdn.jable.tv/a/preview.jpg', actress: '西宮夢' }
    ),
    { title: 'IPZZ-751 同學會', imageUrl: 'https://assets-cdn.jable.tv/a/preview.jpg', actress: '西宮夢' }
  );
  assert.equal(
    getPlaceholderRepairPatch(
      { ...base, title: 'IPZZ-751 同學會', imageUrl: 'https://assets-cdn.jable.tv/a/preview.jpg' },
      { ...base, title: 'IPZZ-751 新', imageUrl: 'https://x.jable.tv/b.jpg' }
    ),
    null
  );
});

test('佔位片補資料：原連結已下架（404 標題）時由其他片源接手連結', () => {
  assert.deepEqual(
    getPlaceholderRepairPatch(
      { code: 'DASS-011', title: '404 Not Found', url: 'https://jable.tv/videos/dass-011/', source: 'Jable', imageUrl: 'https://fourhoi.com/dass-011/cover-n.jpg' },
      { code: 'DASS-011', title: 'DASS-011 標題', url: 'https://missav.ai/dass-011', source: 'MissAV', imageUrl: 'https://fourhoi.com/dass-011/cover-n.jpg' }
    ),
    { title: 'DASS-011 標題', url: 'https://missav.ai/dass-011', source: 'MissAV' }
  );
});

test('錯誤頁判斷只認已知錯誤片語，數字開頭或含 Not Found 字樣的正常片名不誤判', () => {
  for (const title of ['435MFC-123 素人', '529STCV-001', '480分 ベスト', '500 人斬り', '500 Best Hits', 'MISSION NOT FOUND 特典']) {
    assert.equal(isUnusableDetailPage(200, title), false, title);
  }
  for (const title of ['404 Not Found', '403 Forbidden', '502 Bad Gateway', 'Page Not Found', 'Not Found', '404']) {
    assert.equal(isUnusableDetailPage(200, title), true, title);
  }
});
