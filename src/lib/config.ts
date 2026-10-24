import { db } from './db/client';
import { appConfig } from './db/schema';

interface AppConfig {
  trackedTags: string[];
  makerMap: Record<string, string>;
  preferredIssuers: string[];
  preferredActresses: string[];
  blockedIssuers: string[];
  blockedActresses: string[];
  blockedTags: string[];
}

/** DB 裡「從沒設定過」的 key 才用這組空預設；讀取失敗一律拋錯，不得落到這裡。 */
const MISSING_KEY_DEFAULTS: AppConfig = {
  trackedTags: [],
  makerMap: {},
  preferredIssuers: [],
  preferredActresses: [],
  blockedIssuers: [],
  blockedActresses: [],
  blockedTags: [],
};

const KEY_MAP: Record<string, keyof AppConfig> = {
  tracked_tags: 'trackedTags',
  maker_map: 'makerMap',
  preferred_issuers: 'preferredIssuers',
  preferred_actresses: 'preferredActresses',
  blocked_issuers: 'blockedIssuers',
  blocked_actresses: 'blockedActresses',
  blocked_tags: 'blockedTags',
};

/**
 * 最後一次成功載入的設定（純粹給 sync 存取器 `getCachedConfig` 用）。
 * 不再做跨請求快取——Vercel serverless 多實例下，舊版 60s TTL 會造成
 * POST 在實例 A 寫入並 invalidate，但實例 B 仍服務舊資料 → 重整看不到變更。
 * 每次 `getConfig()` 都重新讀 DB，反正都是 sub-100ms 的 Turso 查詢。
 */
let lastLoaded: AppConfig | null = null;
let inflight: Promise<AppConfig> | null = null;

async function loadFromDb(): Promise<AppConfig> {
  const rows = await db.select().from(appConfig);
  const result: AppConfig = { ...MISSING_KEY_DEFAULTS };
  for (const row of rows) {
    const camelKey = KEY_MAP[row.key];
    if (!camelKey) continue;
    try {
      (result as unknown as Record<string, unknown>)[camelKey] = JSON.parse(row.value);
    } catch {
      // 壞值當空值會讓下一次 merge 寫入（例如 maker_map）把整份設定洗掉
      throw new Error(`[config] ${row.key} 不是合法 JSON：${row.value.slice(0, 80)}`);
    }
  }
  return result;
}

/**
 * 讀取全部設定；DB 失敗或資料損壞時拋錯。
 * 不可回傳空設定當備援：/api/config 的 makerMap merge、設定頁存檔都會拿它當
 * 「目前狀態」寫回去，等於把真資料洗成空的（同 2026-09-21 收藏洗空事故）。
 */
export async function getConfig(): Promise<AppConfig> {
  // 同一請求內並發呼叫去重（避免一次 render 內多次 await getConfig 觸發多筆 DB）
  if (inflight) return inflight;
  inflight = loadFromDb()
    .then((cfg) => {
      lastLoaded = cfg;
      return cfg;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** 已 await 過 getConfig 後的同步存取（給 metadata.ts 之類的純函式用）。 */
export function getCachedConfig(): AppConfig {
  return lastLoaded ?? MISSING_KEY_DEFAULTS;
}

/** 留作 no-op 相容介面（不再需要顯式 invalidate；每次 getConfig 都會重讀）。 */
export function invalidateConfigCache(): void {
  lastLoaded = null;
}
