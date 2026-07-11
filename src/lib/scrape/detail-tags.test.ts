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
