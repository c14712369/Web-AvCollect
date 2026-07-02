import type { CheerioAPI } from 'cheerio';

/**
 * 各站詳情頁「內容標籤」抓取（吃已載入的 CheerioAPI，供手動新增路由用）。
 * 規則與 AvBatch/src/scrapers/detail-tags.ts 一致；屬站台專屬抓取細節，兩端各維護一份。
 */

const STOPWORDS = new Set([
  '高清', '高畫質', '獨家', '中文字幕', '字幕', '4K', '8K', 'VR', 'HDR',
  '無碼', '馬賽克破壞版', '數位馬賽克', 'DMM專屬', 'DMM獨家',
  'JavPlayer Decensored', 'Decensored', 'Reducing Mosaic',
  '全部標簽', '全部標籤', '分類找片', '按主題', '按女優', 'movie',
]);

/** 單片標籤上限：避免 Javrate 動輒 50 個關鍵字污染口味側寫與版面。 */
const MAX_TAGS = 15;

const clean = (arr: string[]): string[] =>
  Array.from(
    new Set(
      arr
        .map((s) => s.replace(/^#/, '').trim())
        .filter((s) => s && !STOPWORDS.has(s) && !/^[\p{Emoji}\s]+/u.test(s))
    )
  ).slice(0, MAX_TAGS);

function missav($: CheerioAPI): string[] {
  let raw: string[] = [];
  $('span').each((_, el) => {
    if ($(el).text().trim() === '類型:') {
      raw = $(el).parent().find('a[href*="/genres/"]').map((_, a) => $(a).text().trim()).get();
      return false;
    }
  });
  return clean(raw);
}

const jable = ($: CheerioAPI): string[] => clean($('.tags a').map((_, a) => $(a).text().trim()).get());
// 只取本片專屬的 .key-container；其餘 /keywords/ 是跨片共用熱門關鍵字 widget 與導覽。
const javrate = ($: CheerioAPI): string[] =>
  clean($('.key-container a[href*="/keywords/"]').map((_, a) => $(a).text().trim()).get());
const supjav = ($: CheerioAPI): string[] =>
  clean($('.tags a[rel="tag"]').map((_, a) => $(a).text().trim()).get());

/** 依來源抽詳情頁標籤；非支援來源回空陣列。 */
export function extractTagsBySource(source: string, $: CheerioAPI): string[] {
  if (source === 'MissAV') return missav($);
  if (source === 'Jable') return jable($);
  if (source === 'Javrate') return javrate($);
  if (source === 'SupJav') return supjav($);
  return [];
}

// ─── 結構化女優名萃取 ──────────────────────────────────────

/** MissAV：資訊面板「女優:」行的 a[href*="/actresses/"] 連結文字。 */
function missavActress($: CheerioAPI): string | null {
  let name: string | null = null;
  $('span').each((_, el) => {
    if ($(el).text().trim() === '女優:') {
      const link = $(el).parent().find('a[href*="/actresses/"]').first();
      const text = link.text().trim();
      if (text) name = text;
      return false;
    }
  });
  return name;
}

/** Jable：.info-header .models a 連結文字。 */
function jableActress($: CheerioAPI): string | null {
  const text = $('.models a').first().text().trim();
  return text || null;
}

/** Javrate：a[href*="/av-idol/"] 連結文字（排除導覽列共用連結）。 */
function javrateActress($: CheerioAPI): string | null {
  const text = $('a[href*="/av-idol/"]').first().text().trim();
  return text || null;
}

/** SupJav：.post-meta a[href*="/actress/"] 連結文字。 */
function supjavActress($: CheerioAPI): string | null {
  const text = $('a[href*="/actress/"]').first().text().trim();
  return text || null;
}

/**
 * 依來源從詳情頁的結構化欄位萃取女優名；抓不到回 null。
 * 比 regex 從標題猜更可靠：MissAV 中文翻譯標題常不以女優名結尾。
 */
export function extractActressBySource(source: string, $: CheerioAPI): string | null {
  if (source === 'MissAV') return missavActress($);
  if (source === 'Jable') return jableActress($);
  if (source === 'Javrate') return javrateActress($);
  if (source === 'SupJav') return supjavActress($);
  return null;
}

