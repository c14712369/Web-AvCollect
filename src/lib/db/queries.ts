import { desc, eq } from 'drizzle-orm';
import { db } from './client';
import { movies, favorites, appConfig, type MovieInsert } from './schema';
import { extractMaker, extractThemes, extractActress } from '@/lib/metadata';
import { matchActress } from '@/lib/actress-matcher';
import { getConfig } from '@/lib/config';
import {
  buildProfileFromFeatures,
  classify,
  hasActressMatch,
  toIssuer,
  type MovieFeatures,
} from '@/lib/taste/core';
import type { Movie } from '@/types/av';

/** 解析 DB tags 欄（JSON string[]），壞資料/空值回空陣列。 */
const parseTags = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** 一部片的有效主題：優先用詳情頁抓的真實類型，沒有才退回標題比對追蹤標籤。 */
const themesOf = (row: typeof movies.$inferSelect): string[] => {
  const real = parseTags(row.tags);
  return real.length ? real : extractThemes(row.title);
};

const enrich = (row: typeof movies.$inferSelect, prefActresses: string[]): Movie => {
  let act = row.actress || extractActress(row.title);
  if (!act) {
    const found = prefActresses.find((prefName) => matchActress(prefName, row.title));
    if (found) {
      act = found;
    }
  }
  return {
    code: row.code,
    title: row.title,
    url: row.url,
    imageUrl: row.imageUrl,
    source: row.source,
    category: row.category,
    releaseDate: row.releaseDate ?? null,
    maker: extractMaker(row.code),
    themes: themesOf(row),
    actress: act,
  };
};

const featuresOf = (row: typeof movies.$inferSelect, prefActresses: string[]): MovieFeatures => {
  let act = row.actress || extractActress(row.title);
  if (!act) {
    const found = prefActresses.find((prefName) => matchActress(prefName, row.title));
    if (found) {
      act = found;
    }
  }
  return {
    issuer: toIssuer(row.code),
    actress: act,
    themes: themesOf(row),
  };
};

export const listMovies = async (): Promise<Movie[]> => {
  const cfg = await getConfig();
  const rows = await db
    .select()
    .from(movies)
    .orderBy(desc(movies.createdAt));

  // 由收藏行為 + 手動清單即時建立口味側寫，再為每部片算契合度。
  const favCodes = new Set(await listFavorites());
  const profile = buildProfileFromFeatures(
    rows.filter((r) => favCodes.has(r.code)).map((r) => featuresOf(r, cfg.preferredActresses)),
    {
      preferredActresses: cfg.preferredActresses,
      preferredIssuers: cfg.preferredIssuers,
      preferredTags: cfg.trackedTags,
    }
  );

  // 標籤軟黑名單：隱藏命中黑名單標籤的片，但追蹤女優優先保留
  const blocked = new Set(cfg.blockedTags);
  const visible = blocked.size === 0
    ? rows
    : rows.filter((row) => {
        const feats = featuresOf(row, cfg.preferredActresses);
        const hit = feats.themes.some((t) => blocked.has(t));
        return !hit || hasActressMatch(feats, profile);
      });

  return visible.map((row) => {
    const match = classify(featuresOf(row, cfg.preferredActresses), profile);
    return {
      ...enrich(row, cfg.preferredActresses),
      matchScore: match.score,
      matchTier: match.tier,
      matchReasons: match.reasons,
      matchBreakdown: match.breakdown,
    };
  });
};

export const insertMovie = async (data: MovieInsert): Promise<Movie | null> => {
  const cfg = await getConfig();
  const exists = await db
    .select()
    .from(movies)
    .where(eq(movies.code, data.code))
    .limit(1);
  if (exists.length > 0) return null;
  await db.insert(movies).values(data);
  const inserted = await db
    .select()
    .from(movies)
    .where(eq(movies.code, data.code))
    .limit(1);
  return inserted[0] ? enrich(inserted[0], cfg.preferredActresses) : null;
};

export const listFavorites = async (): Promise<string[]> => {
  const rows = await db.select({ code: favorites.code }).from(favorites);
  return rows.map((r) => r.code);
};

export const setFavorites = async (codes: string[]): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.delete(favorites);
    if (codes.length === 0) return;
    await tx
      .insert(favorites)
      .values(codes.map((code) => ({ code })));
  });
};

export const deleteMovie = async (code: string): Promise<boolean> => {
  await db.delete(movies).where(eq(movies.code, code));
  return true;
};

/** 寫入（或覆蓋）某個 app_config 陣列鍵。 */
export const setConfigArray = async (key: string, value: string[]): Promise<void> => {
  const json = JSON.stringify(value);
  await db
    .insert(appConfig)
    .values({ key, value: json })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { value: json, updatedAt: new Date() },
    });
};

/** 寫入（或覆蓋）某個 app_config 物件鍵。 */
export const setConfigObject = async (key: string, value: Record<string, string>): Promise<void> => {
  const json = JSON.stringify(value);
  await db
    .insert(appConfig)
    .values({ key, value: json })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { value: json, updatedAt: new Date() },
    });
};

export interface TagSettings {
  trackedTags: string[];
  blockedTags: string[];
  blockedIssuers: string[];
  makerMap: Record<string, string>;
  /** 收藏裡常出現、但尚未追蹤/封鎖的標籤，供「加入追蹤」一鍵用。 */
  suggestions: string[];
  /** 只出現在「未收藏」片裡（從沒進過你收藏）的常見標籤，供「加入黑名單」一鍵用。 */
  blockedSuggestions: string[];
  /** 手動維護的喜愛女優名單（baseline 加分 + 牆面篩選用）。 */
  preferredActresses: string[];
  /** 收藏裡常出現、但尚未列入喜愛名單的女優，供「加入名單」一鍵用。 */
  actressSuggestions: string[];
}

export const getTagSettings = async (): Promise<TagSettings> => {
  const cfg = await getConfig();
  const favCodes = new Set(await listFavorites());
  const rows = await db.select().from(movies);

  const favCounts = new Map<string, number>();
  const nonFavCounts = new Map<string, number>();
  for (const row of rows) {
    const target = favCodes.has(row.code) ? favCounts : nonFavCounts;
    for (const t of themesOf(row)) target.set(t, (target.get(t) ?? 0) + 1);
  }

  // 喜愛女優建議：你收藏裡常出現、但尚未列入手動名單的女優
  const prefActressSet = new Set(cfg.preferredActresses);
  const actressCounts = new Map<string, number>();
  for (const row of rows) {
    if (!favCodes.has(row.code)) continue;
    const a = extractActress(row.title);
    if (a) actressCounts.set(a, (actressCounts.get(a) ?? 0) + 1);
  }
  const actressSuggestions = [...actressCounts.entries()]
    .filter(([a]) => !prefActressSet.has(a))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([a]) => a);

  const tracked = new Set(cfg.trackedTags);
  const blocked = new Set(cfg.blockedTags);

  // 追蹤建議：你收藏裡常出現、但未追蹤未封鎖（= 你會喜歡）
  const suggestions = [...favCounts.entries()]
    .filter(([t]) => !tracked.has(t) && !blocked.has(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([t]) => t);

  // 黑名單建議：只出現在「未收藏的片」的常見標籤（= 你從來沒興趣留下的）
  // 過濾掉曾在收藏裡出現過 (favCounts.has) 的 tag，避免跟上面建議重複
  const blockedSuggestions = [...nonFavCounts.entries()]
    .filter(([t]) => !tracked.has(t) && !blocked.has(t) && !favCounts.has(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([t]) => t);

  return {
    trackedTags: cfg.trackedTags,
    blockedTags: cfg.blockedTags,
    blockedIssuers: cfg.blockedIssuers,
    makerMap: cfg.makerMap,
    suggestions,
    blockedSuggestions,
    preferredActresses: cfg.preferredActresses,
    actressSuggestions,
  };
};
