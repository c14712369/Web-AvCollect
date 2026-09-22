import { desc, eq, and, lt, inArray, sql } from 'drizzle-orm';
import { db } from './client';
import {
  movies,
  favorites,
  appConfig,
  viewedMovies,
  favoritesSnapshots,
  type MovieInsert,
} from './schema';
import { extractMaker, extractThemes, extractActress } from '@/lib/metadata';
import { matchActress } from '@/lib/actress-matcher';
import { getConfig } from '@/lib/config';
import { decideCleanup } from '@/lib/cleanup-guard';
import {
  buildProfileFromFeatures,
  classify,
  hasActressMatch,
  toIssuer,
  type MovieFeatures,
} from '@/lib/taste/core';
import type { Movie } from '@/types/av';
import { shouldUpgradeSource } from '@/lib/manual-movie';

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
    addedAt: row.createdAt.toISOString(),
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

/** 自動確保 viewed_movies 資料表存在。 */
let ensuredViewedTable = false;
export async function ensureViewedMoviesTable(): Promise<void> {
  if (ensuredViewedTable) return;
  try {
    await db.run(
      sql`CREATE TABLE IF NOT EXISTS viewed_movies (code TEXT PRIMARY KEY, viewed_at INTEGER NOT NULL DEFAULT (unixepoch()))`
    );
    ensuredViewedTable = true;
  } catch (e) {
    console.warn('[db] ensureViewedMoviesTable warning:', e);
  }
}

/** 記錄使用者點進去瀏覽過的影片 */
export async function recordMovieView(code: string): Promise<void> {
  if (!code) return;
  await ensureViewedMoviesTable();
  try {
    await db
      .insert(viewedMovies)
      .values({ code, viewedAt: new Date() })
      .onConflictDoUpdate({
        target: viewedMovies.code,
        set: { viewedAt: new Date() },
      });
  } catch (err) {
    console.warn('[db] recordMovieView failed:', err);
  }
}

/** 取得所有已點擊瀏覽過的番號集合 */
export async function listViewedCodes(): Promise<Set<string>> {
  await ensureViewedMoviesTable();
  try {
    const rows = await db.select({ code: viewedMovies.code }).from(viewedMovies);
    return new Set(rows.map((r) => r.code));
  } catch {
    return new Set();
  }
}

let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 30 * 60 * 1000; // 每 30 分鐘最多檢查一次自動清理

/**
 * 自動清理入庫滿 2 週、發行女優非喜愛女優且未曾點進去瀏覽過的影片：
 * 條件：
 * 1. createdAt < 14 天前
 * 2. 發行女優不是喜愛女優（preferredActresses）
 * 3. 2 週內使用者未曾點進去瀏覽過（not in viewed_movies）
 * 4. 非收藏影片（not in favorites）
 * 5. 非使用者手動新增的影片（category !== '使用者新增'）
 */
export async function cleanupStaleUnviewedMovies(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastCleanupTime < CLEANUP_INTERVAL) {
    return 0;
  }
  lastCleanupTime = now;

  try {
    await ensureViewedMoviesTable();
    const cfg = await getConfig();
    const favCodes = new Set(await listFavorites());
    const viewedCodes = await listViewedCodes();
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    // 撈取入庫滿 14 天的影片進行檢查
    const oldMovies = await db
      .select()
      .from(movies)
      .where(lt(movies.createdAt, twoWeeksAgo));

    const toDelete: string[] = [];
    for (const m of oldMovies) {
      // 1. 已收藏的影片絕對保留
      if (favCodes.has(m.code)) continue;

      // 2. 曾點進去瀏覽過的影片保留
      if (viewedCodes.has(m.code)) continue;

      // 3. 使用者手動新增的影片保留
      if (m.category === '使用者新增') continue;

      // 4. 女優為喜愛女優的保留（支援結構化 actress 與標題比對）
      const act = m.actress || extractActress(m.title);
      const isFavActress = cfg.preferredActresses.some(
        (pref) => (act && matchActress(pref, act)) || matchActress(pref, m.title)
      );
      if (isFavActress) continue;

      // 符合自動清理條件
      toDelete.push(m.code);
    }

    // 自動刪片不可逆，且仰賴收藏/瀏覽紀錄當保護傘：
    // 保護訊號異常或單次刪除量過大時一律中止，等人確認（見 cleanup-guard）。
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(movies);
    const decision = decideCleanup({
      totalMovies: Number(total),
      favoritesCount: favCodes.size,
      plannedDeletions: toDelete.length,
    });
    if (!decision.proceed) {
      console.warn(`[cleanup] 已中止：${decision.reason}`);
      console.warn(`[cleanup] 原本要刪的番號：${toDelete.join(', ')}`);
      return 0;
    }

    if (toDelete.length > 0) {
      console.log(`[cleanup] 即將移除 ${toDelete.length} 部：${toDelete.join(', ')}`);
      const chunkSize = 100;
      for (let i = 0; i < toDelete.length; i += chunkSize) {
        const chunk = toDelete.slice(i, i + chunkSize);
        await db.delete(movies).where(inArray(movies.code, chunk));
      }
      console.log(`[cleanup] 自動移除了 ${toDelete.length} 部超過兩週未點擊瀏覽的非喜愛女優影片`);
    }
    return toDelete.length;
  } catch (err) {
    console.warn('[cleanup] cleanupStaleUnviewedMovies failed:', err);
    return 0;
  }
}

export const listMovies = async (): Promise<Movie[]> => {
  // 自動清理過期且未曾瀏覽的非喜愛女優影片
  try {
    await cleanupStaleUnviewedMovies();
  } catch (e) {
    console.warn('[listMovies] auto cleanup error:', e);
  }

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

export type UpsertMovieResult = {
  movie: Movie;
  outcome: 'inserted' | 'upgraded' | 'existing';
};

/**
 * 手動新增遇到同番號時，不再一律失敗：僅較高優先度片源可更新既有連結。
 * 空白封面/標題不覆蓋原有資料，避免被遭封鎖的詳情頁降級。
 */
export const upsertMovieBySourcePriority = async (data: MovieInsert): Promise<UpsertMovieResult> => {
  const cfg = await getConfig();
  const existing = await db.select().from(movies).where(eq(movies.code, data.code)).limit(1);

  if (existing.length === 0) {
    await db.insert(movies).values(data);
    const inserted = await db.select().from(movies).where(eq(movies.code, data.code)).limit(1);
    return { movie: enrich(inserted[0], cfg.preferredActresses), outcome: 'inserted' };
  }

  const current = existing[0];
  if (!shouldUpgradeSource(current.source, data.source)) {
    return { movie: enrich(current, cfg.preferredActresses), outcome: 'existing' };
  }

  await db.update(movies).set({
    url: data.url,
    source: data.source,
    ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
    ...(data.title && data.title !== data.code ? { title: data.title } : {}),
    ...(data.tags ? { tags: data.tags } : {}),
    ...(data.actress ? { actress: data.actress } : {}),
  }).where(eq(movies.code, data.code));
  const updated = await db.select().from(movies).where(eq(movies.code, data.code)).limit(1);
  return { movie: enrich(updated[0], cfg.preferredActresses), outcome: 'upgraded' };
};

export const listFavorites = async (): Promise<string[]> => {
  const rows = await db.select({ code: favorites.code }).from(favorites);
  return rows.map((r) => r.code);
};

/** 單筆加入收藏；不動其他資料列（toggle 專用）。 */
export const addFavorite = async (code: string): Promise<void> => {
  await db.insert(favorites).values({ code }).onConflictDoNothing();
};

/** 單筆移除收藏；不動其他資料列（toggle 專用）。 */
export const removeFavorite = async (code: string): Promise<void> => {
  await db.delete(favorites).where(eq(favorites.code, code));
};

/** 收藏快照保留份數。 */
const FAVORITES_SNAPSHOT_KEEP = 20;

let ensuredSnapshotTable = false;
/** 自動確保 favorites_snapshots 資料表存在。 */
export async function ensureFavoritesSnapshotTable(): Promise<void> {
  if (ensuredSnapshotTable) return;
  try {
    await db.run(
      sql`CREATE TABLE IF NOT EXISTS favorites_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, taken_at INTEGER NOT NULL DEFAULT (unixepoch()), reason TEXT NOT NULL, codes TEXT NOT NULL)`
    );
    ensuredSnapshotTable = true;
  } catch (e) {
    console.warn('[db] ensureFavoritesSnapshotTable warning:', e);
  }
}

/**
 * 把目前的收藏清單留成快照（只保留最近 FAVORITES_SNAPSHOT_KEEP 份）。
 * 空清單不留底，免得把真正有用的舊快照擠掉。
 */
export const snapshotFavorites = async (reason: string): Promise<void> => {
  await ensureFavoritesSnapshotTable();
  try {
    const codes = await listFavorites();
    if (codes.length === 0) return;
    await db.insert(favoritesSnapshots).values({ reason, codes: JSON.stringify(codes) });
    const keep = await db
      .select({ id: favoritesSnapshots.id })
      .from(favoritesSnapshots)
      .orderBy(desc(favoritesSnapshots.id))
      .limit(FAVORITES_SNAPSHOT_KEEP);
    if (keep.length === FAVORITES_SNAPSHOT_KEEP) {
      const oldest = keep[keep.length - 1].id;
      await db.delete(favoritesSnapshots).where(lt(favoritesSnapshots.id, oldest));
    }
    console.log(`[favorites] 覆蓋前留下快照（${reason}）：${codes.length} 筆`);
  } catch (err) {
    console.warn('[favorites] snapshotFavorites failed:', err);
  }
};

export interface FavoritesSnapshot {
  takenAt: Date;
  reason: string;
  codes: string[];
}

/** 取回收藏快照，最新的排最前面。 */
export const listFavoritesSnapshots = async (): Promise<FavoritesSnapshot[]> => {
  await ensureFavoritesSnapshotTable();
  const rows = await db
    .select()
    .from(favoritesSnapshots)
    .orderBy(desc(favoritesSnapshots.id));
  return rows.map((r) => ({
    takenAt: r.takenAt,
    reason: r.reason,
    codes: parseTags(r.codes),
  }));
};

/**
 * 整份覆蓋收藏（僅供匯入使用）。
 * 這是唯一會清空整張表的路徑，呼叫端必須是使用者明確要求覆蓋，
 * 且一律先留下快照，讓覆蓋錯了還有得救。
 */
export const setFavorites = async (codes: string[]): Promise<void> => {
  await snapshotFavorites('replace');
  const before = await listFavorites();
  await db.transaction(async (tx) => {
    await tx.delete(favorites);
    if (codes.length === 0) return;
    await tx
      .insert(favorites)
      .values(codes.map((code) => ({ code })));
  });
  console.log(`[favorites] 整份覆蓋：${before.length} 筆 → ${codes.length} 筆`);
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
