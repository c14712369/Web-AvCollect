import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { extractActressBySource } from './detail-tags';

// Jable 女優頭像有兩種渲染：有照片時是 <img title="全名">，
// 無照片時是 <span class="placeholder" title="全名">姓氏首字</span>。
// 兩種都必須取 title 的全名，不能拿連結文字（placeholder 只有一個字）。

test('Jable：無頭像 placeholder 取 title 全名（SONE-467 實例）', () => {
  const $ = cheerio.load(`
    <div class="models">
      <a class="model" href="https://jable.tv/models/67cdd605766a5a8fa221469fcb60ef9c/">
        <span class="placeholder rounded-circle" data-toggle="tooltip" title="白上咲花">白</span>
      </a>
    </div>`);
  assert.equal(extractActressBySource('Jable', $), '白上咲花');
});

test('Jable：有頭像 img 取 title 全名', () => {
  const $ = cheerio.load(`
    <div class="models">
      <a class="model" href="https://jable.tv/models/abc/">
        <img src="https://assets.jable.tv/model.jpg" title="三上悠亜" alt="三上悠亜">
      </a>
    </div>`);
  assert.equal(extractActressBySource('Jable', $), '三上悠亜');
});

test('Jable：找不到 models 區塊回 null', () => {
  const $ = cheerio.load('<div class="other"></div>');
  assert.equal(extractActressBySource('Jable', $), null);
});

// 與 AvBatch 的 extractJavrateActress 同步（2026-09-23）：
// 本專案原本找 /av-idol/，實際頁面根本沒有這個路徑；本片卡司在 .actor-card，
// .mgn-box 則是相關影片（別人的女優）。
test('Javrate：只取 .actor-card 內的本片女優，忽略相關影片區塊', () => {
  const $ = cheerio.load(`
    <div class="actor-card">
      <div class="thumb">
        <a href="/actor/detail/abc123.html"><img src="x.jpg"></a>
        <h5 class="swiper-overlay"><a href="/actor/detail/abc123.html">白上咲花</a></h5>
      </div>
    </div>
    <div class="mgn-box"><div class="mgn-actress"><a href="/actor/detail/zzz.html">宮島芽衣</a></div></div>`);
  assert.equal(extractActressBySource('Javrate', $), '白上咲花');
});

test('Javrate：多位女優以頓號串接', () => {
  const $ = cheerio.load(`
    <div class="actor-card"><h5><a href="/actor/detail/a1.html">河北彩伽</a></h5></div>
    <div class="actor-card"><h5><a href="/actor/detail/a2.html">石川澪</a></h5></div>`);
  assert.equal(extractActressBySource('Javrate', $), '河北彩伽、石川澪');
});
