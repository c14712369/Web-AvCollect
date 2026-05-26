import { desc, eq } from 'drizzle-orm';
import { db } from './client';
import { movies, favorites, appConfig, type MovieInsert } from './schema';
import { extractMaker, extractThemes, extractActress } from '@/lib/metadata';
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

const enrich = (row: typeof movies.$inferSelect): Movie => ({
  code: row.code,
  title: row.title,
  url: row.url,
  imageUrl: row.imageUrl,
  source: row.source,
  category: row.category,
  releaseDate: row.releaseDate ?? null,
  maker: extractMaker(row.code),
  themes: themesOf(row),
  actress: extractActress(row.title),
});

const featuresOf = (row: typeof movies.$inferSelect): MovieFeatures => ({
  issuer: toIssuer(row.code),
  actress: extractActress(row.title),
  themes: themesOf(row),
});

export const listMovies = async (): Promise<Movie[]> => {
  const cfg = await getConfig();
  const rows = await db
    .select()
    .from(movies)
    .orderBy(desc(movies.createdAt));

  // 由收藏行為 + 手動清單即時建立口味側寫，再為每部片算契合度。
  const favCodes = new Set(await listFavorites());
  const profile = buildProfileFromFeatures(
    rows.filter((r) => favCodes.has(r.code)).map(featuresOf),
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
        const feats = featuresOf(row);
        const hit = feats.themes.some((t) => blocked.has(t));
        return !hit || hasActressMatch(feats, profile);
      });

  return visible.map((row) => {
    const match = classify(featuresOf(row), profile);
    return {
      ...enrich(row),
      matchScore: match.score,
      matchTier: match.tier,
      matchReasons: match.reasons,
      matchBreakdown: match.breakdown,
    };
  });
};

export const insertMovie = async (data: MovieInsert): Promise<Movie | null> => {
  await getConfig();
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
  return inserted[0] ? enrich(inserted[0]) : null;
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
  /** 收藏裡常出現、但尚未追蹤/封鎖的標籤（依出現次數排序），供一鍵加入。 */
  suggestions: string[];
}

export const getTagSettings = async (): Promise<TagSettings> => {
  const cfg = await getConfig();
  const favCodes = new Set(await listFavorites());
  const rows = await db.select().from(movies);

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!favCodes.has(row.code)) continue;
    for (const t of themesOf(row)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  const tracked = new Set(cfg.trackedTags);
  const blocked = new Set(cfg.blockedTags);
  const suggestions = [...counts.entries()]
    .filter(([t]) => !tracked.has(t) && !blocked.has(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([t]) => t);

  return {
    trackedTags: cfg.trackedTags,
    blockedTags: cfg.blockedTags,
    blockedIssuers: cfg.blockedIssuers,
    makerMap: cfg.makerMap,
    suggestions,
  };
};
