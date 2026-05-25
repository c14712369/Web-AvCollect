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

const FALLBACK: AppConfig = {
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

let cache: AppConfig | null = null;
let promise: Promise<AppConfig> | null = null;
let cachedAt = 0;
const TTL_MS = 60_000; // 1 分鐘 cache，dashboard 改設定後最多 60s 生效

async function loadFromDb(): Promise<AppConfig> {
  const rows = await db.select().from(appConfig);
  const result: AppConfig = { ...FALLBACK };
  for (const row of rows) {
    const camelKey = KEY_MAP[row.key];
    if (!camelKey) continue;
    try {
      (result as unknown as Record<string, unknown>)[camelKey] = JSON.parse(row.value);
    } catch {
      console.error(`[config] failed to parse ${row.key}:`, row.value);
    }
  }
  return result;
}

export async function getConfig(): Promise<AppConfig> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;
  if (promise) return promise;

  promise = loadFromDb()
    .then((cfg) => {
      cache = cfg;
      cachedAt = Date.now();
      promise = null;
      return cfg;
    })
    .catch((err) => {
      console.error('[config] load failed, using fallback:', err);
      promise = null;
      return FALLBACK;
    });

  return promise;
}

export function getCachedConfig(): AppConfig {
  return cache ?? FALLBACK;
}

export function invalidateConfigCache(): void {
  cache = null;
  cachedAt = 0;
}
