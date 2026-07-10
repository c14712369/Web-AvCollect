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
const BLOCKED_ACTRESS_SUFFIXES = new Set([
  'HD', '4K', 'VR', 'AV', '3P', '4P', '5P', '6P', '8P', '10P', 'BEST', 'SP', 'FC2', 'PPV', 'CS'
]);

const CLEAN_SUFFIX_RE = /(\s*[\(\[\{]?(?:4K|HD|VR|AV|3P|4P|5P|6P|8P|10P|BEST|SP|FC2|PPV|CS|uncensored|無修正)[\)\]\}]?)+$/i;

export function extractActress(title: string): string | null {
  let temp = title.trim();
  
  // 循環移除結尾的無意義修飾後綴（例如 HD、(HD)、[4K] 等），避免其干擾女優名提取
  let prev: string;
  do {
    prev = temp;
    temp = temp.replace(CLEAN_SUFFIX_RE, '').trim();
  } while (temp !== prev);

  const match = temp.match(/(?:~|-|—|－|\s)([一-龥ぁ-んァ-ヶa-zA-Z\s\.]+)$/);
  if (match) {
    const name = match[1].trim();
    const isCjk = /^[一-龥ぁ-んァ-ヶ]+$/.test(name);
    if (isCjk) {
      if (name.length >= 2 && name.length <= 6) {
        return name;
      }
      return null;
    }
    
    const cleanName = name.replace(/\.$/, '');
    if (cleanName.length >= 2 && cleanName.length <= 25) {
      if (BLOCKED_ACTRESS_SUFFIXES.has(cleanName.toUpperCase())) {
        return null;
      }
      return cleanName;
    }
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
