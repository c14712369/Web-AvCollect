/**
 * 口味契合度評分核心（純函式，零外部 import）。
 *
 * ⚠️ 這支檔案是「兩專案共用」的 source of truth。
 *    AvBatch 端會逐字同步成 src/services/taste-core.ts（npm run sync-taste）。
 *    因此：請勿在此 import 任何專案專屬模組，保持自我完備可被原樣複製。
 *
 * 設計：
 *  - 不再用「有無命中」二元判斷，改為對每部片算 0–100 的契合度分數。
 *  - 分數來源 = 使用者的收藏行為（自動學）+ 手動清單（baseline）。
 *  - 依分數分級 high / medium / low，供推播分級與 App 端徽章/排序使用。
 */

export type MatchTier = 'high' | 'medium' | 'low';

/** 一部片萃取出的口味特徵（由各專案各自萃取後傳入）。 */
export interface MovieFeatures {
  /** 番號前綴（大寫），作為廠商訊號。 */
  issuer: string;
  /** 女優名（標題尾端 CJK），無則 null。 */
  actress: string | null;
  /** 命中的追蹤標籤。 */
  themes: string[];
}

/** 手動清單（來自 Turso app_config），作為 baseline 權重與「永不降級」依據。 */
export interface ManualLists {
  preferredActresses: string[];
  preferredIssuers: string[];
  preferredTags: string[];
}

/** 從收藏 + 手動清單建出的口味側寫。 */
export interface TasteProfile {
  /** 女優 → 權重（出現次數）。 */
  actress: Record<string, number>;
  /** 廠商前綴 → 權重。 */
  issuer: Record<string, number>;
  /** 標籤 → 權重。 */
  theme: Record<string, number>;
}

export interface MatchBreakdown {
  actress: { hit: string | null; score: number; weight: number };
  issuer: { hit: string | null; score: number; weight: number };
  themes: { hits: string[]; score: number };
}

export interface MatchResult {
  /** 0–100 契合度分數。 */
  score: number;
  tier: MatchTier;
  /** 人類可讀的命中原因（給 App / 推播顯示）。 */
  reasons: string[];
  /** 完整評分明細（給 App 「為什麼?」彈窗用）。 */
  breakdown: MatchBreakdown;
}

/** 評分權重與飽和設定（集中管理，方便上線後微調手感）。 */
export const TASTE_WEIGHTS = {
  /** 女優是最強訊號。 */
  actressMax: 60,
  issuerMax: 25,
  themeMax: 15,
  /** 某訊號出現幾次即視為「飽和」（達上限分數）。 */
  saturationCount: 3,
  /** 手動追蹤女優的起始權重（直接飽和 → 必為 high）。 */
  manualActressBaseline: 3,
  /** 手動白名單廠商的起始權重（直接飽和）。 */
  manualIssuerBaseline: 3,
  /** 手動追蹤標籤的起始權重。 */
  manualTagBaseline: 2,
} as const;

/**
 * 分級門檻（high / medium 的下限分數）。純分數分級：
 *  - 手動追蹤女優靠 baseline=3 自然得 60 分 → 必為 high。
 *  - 白名單廠商靠 baseline=3 得 25 分 → 落在 medium（可能也喜歡），不強制拉高。
 */
export const TASTE_THRESHOLDS = {
  high: 50,
  medium: 20,
} as const;

/**
 * 從標題萃取女優名（位於標題末尾，2–6 字 CJK 字元）。
 * 與 AvCollect metadata.extractActress 規則一致，集中於此避免漂移。
 */
export function extractActress(title: string): string | null {
  const match = title.match(/(?:~|-|—|－|\s)([一-龥ぁ-んァ-ヶ]+)$/);
  if (match && match[1].length >= 2 && match[1].length <= 6) {
    return match[1].trim();
  }
  return null;
}

/** 從番號取得廠商前綴（大寫）。 */
export function toIssuer(code: string): string {
  return code.split('-')[0].toUpperCase();
}

function saturate(count: number): number {
  return Math.min(1, count / TASTE_WEIGHTS.saturationCount);
}

/**
 * 由「已收藏影片的特徵」與手動清單，建出口味側寫。
 * 手動清單以 Math.max 疊加 baseline，確保明確設定即使尚未收藏也有權重。
 */
export function buildProfileFromFeatures(
  favorites: MovieFeatures[],
  manual: ManualLists,
): TasteProfile {
  const actress: Record<string, number> = {};
  const issuer: Record<string, number> = {};
  const theme: Record<string, number> = {};

  for (const f of favorites) {
    if (f.actress) actress[f.actress] = (actress[f.actress] ?? 0) + 1;
    if (f.issuer) issuer[f.issuer] = (issuer[f.issuer] ?? 0) + 1;
    for (const t of f.themes) theme[t] = (theme[t] ?? 0) + 1;
  }

  for (const a of manual.preferredActresses) {
    actress[a] = Math.max(actress[a] ?? 0, TASTE_WEIGHTS.manualActressBaseline);
  }
  for (const i of manual.preferredIssuers) {
    const key = i.toUpperCase();
    issuer[key] = Math.max(issuer[key] ?? 0, TASTE_WEIGHTS.manualIssuerBaseline);
  }
  for (const t of manual.preferredTags) {
    theme[t] = Math.max(theme[t] ?? 0, TASTE_WEIGHTS.manualTagBaseline);
  }

  return { actress, issuer, theme };
}

/**
 * 對一部片的特徵計算契合度與分級（純分數，無人為強制拉高）。
 * 規則：女優(上限60) + 廠商(上限25) + 標籤(上限15)，每項飽和函數封頂。
 * 分級完全依分數 → 徽章數字與顏色一致（高分卡一律 ≥ high 門檻）。
 */
export function classify(features: MovieFeatures, profile: TasteProfile): MatchResult {
  const reasons: string[] = [];
  const breakdown: MatchBreakdown = {
    actress: { hit: null, score: 0, weight: 0 },
    issuer: { hit: null, score: 0, weight: 0 },
    themes: { hits: [], score: 0 },
  };
  let score = 0;

  if (features.actress) {
    const w = profile.actress[features.actress] ?? 0;
    if (w > 0) {
      const s = saturate(w) * TASTE_WEIGHTS.actressMax;
      score += s;
      reasons.push(`女優 ${features.actress}`);
      breakdown.actress = { hit: features.actress, score: Math.round(s), weight: w };
    }
  }

  const iw = profile.issuer[features.issuer] ?? 0;
  if (iw > 0) {
    const s = saturate(iw) * TASTE_WEIGHTS.issuerMax;
    score += s;
    reasons.push(`廠商 ${features.issuer}`);
    breakdown.issuer = { hit: features.issuer, score: Math.round(s), weight: iw };
  }

  let themeRaw = 0;
  const hitTags: string[] = [];
  for (const t of features.themes) {
    const tw = profile.theme[t] ?? 0;
    if (tw > 0) {
      themeRaw += saturate(tw);
      hitTags.push(t);
    }
  }
  if (themeRaw > 0) {
    const s = Math.min(1, themeRaw) * TASTE_WEIGHTS.themeMax;
    score += s;
    reasons.push(`標籤 ${hitTags.join('、')}`);
    breakdown.themes = { hits: hitTags, score: Math.round(s) };
  }

  score = Math.round(Math.max(0, Math.min(100, score)));

  let tier: MatchTier;
  if (score >= TASTE_THRESHOLDS.high) tier = 'high';
  else if (score >= TASTE_THRESHOLDS.medium) tier = 'medium';
  else tier = 'low';

  return { score, tier, reasons, breakdown };
}

/** 便利判斷：此片是否命中側寫中的任一女優（權重 > 0）。 */
export function hasActressMatch(features: MovieFeatures, profile: TasteProfile): boolean {
  return !!features.actress && (profile.actress[features.actress] ?? 0) > 0;
}
