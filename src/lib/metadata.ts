import { getCachedConfig } from './config';

/**
 * 從番號 prefix 萃取廠商名。未知 prefix 回傳空字串。
 * 使用 Turso `app_config` 的 `maker_map`（請先 `await getConfig()` 預熱 cache）。
 */
export function extractMaker(code: string): string {
  const prefix = code.split('-')[0].toUpperCase();
  return getCachedConfig().makerMap[prefix] ?? '';
}

/**
 * 從標題萃取女優名（位於標題末尾，2-6 字 CJK 字元）。
 * 這個規則目前不從 config 來；之後若想客製化 regex 可移到 config。
 */
export function extractActress(title: string): string | null {
  const match = title.match(/(?:~|-|—|－|\s)([一-龥ぁ-んァ-ヶ]+)$/);
  if (match && match[1].length >= 2 && match[1].length <= 6) {
    return match[1].trim();
  }
  return null;
}

/**
 * 從標題萃取追蹤標籤（白名單來自 Turso `tracked_tags`）。
 * 請先 `await getConfig()` 預熱 cache。
 */
export function extractThemes(title: string): string[] {
  return getCachedConfig().trackedTags.filter((tag) => title.includes(tag));
}
