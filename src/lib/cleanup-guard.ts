/**
 * 自動清理的安全閘。
 *
 * 自動刪片是不可逆的，而它仰賴「已收藏 / 已瀏覽 / 喜愛女優」當保護傘。
 * 2026-09-21 收藏全表被洗掉後，那層保護等於消失，一次清理就可能吃掉大半片庫。
 * 因此在刪除前先檢查保護訊號是否合理、單次刪除量是否過大；有疑慮就中止，等人確認。
 */

export interface CleanupStats {
  /** 片庫總數 */
  totalMovies: number;
  /** 目前收藏筆數（保護訊號） */
  favoritesCount: number;
  /** 本次預計刪除的片數 */
  plannedDeletions: number;
}

export type CleanupDecision = { proceed: true } | { proceed: false; reason: string };

/** 單次刪除上限：全庫兩成。 */
export const CLEANUP_MAX_DELETE_RATIO = 0.2;
/** 小資料庫的固定額度，避免比例上限把正常汰換卡死。 */
export const CLEANUP_MIN_DELETE_ALLOWANCE = 20;
/** 低於這個規模的片庫還在草創期，沒有收藏屬正常。 */
export const CLEANUP_FAVORITES_REQUIRED_FROM = 50;

export const decideCleanup = (stats: CleanupStats): CleanupDecision => {
  const { totalMovies, favoritesCount, plannedDeletions } = stats;

  if (plannedDeletions <= 0) return { proceed: true };

  if (favoritesCount === 0 && totalMovies >= CLEANUP_FAVORITES_REQUIRED_FROM) {
    return {
      proceed: false,
      reason: `收藏清單為空但片庫有 ${totalMovies} 部，保護訊號可能已遺失，中止自動清理`,
    };
  }

  const allowance = Math.max(
    CLEANUP_MIN_DELETE_ALLOWANCE,
    Math.floor(totalMovies * CLEANUP_MAX_DELETE_RATIO)
  );
  if (plannedDeletions > allowance) {
    return {
      proceed: false,
      reason: `單次預計刪除 ${plannedDeletions} 部，超過安全額度 ${allowance} 部（全庫 ${totalMovies} 部），中止自動清理`,
    };
  }

  return { proceed: true };
};
