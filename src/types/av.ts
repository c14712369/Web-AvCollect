import type { MatchTier } from '@/lib/taste/core';

export interface Movie {
  code: string;
  title: string;
  url: string;
  imageUrl: string;
  source: string;
  category: string;
  releaseDate?: string | null; // ISO YYYY-MM-DD
  maker: string;
  themes: string[];
  actress?: string | null;
  /** 口味契合度 0–100（由收藏 + 手動清單即時計算）。 */
  matchScore?: number;
  /** 契合度分級。 */
  matchTier?: MatchTier;
  /** 命中原因（女優/廠商/標籤）。 */
  matchReasons?: string[];
}
