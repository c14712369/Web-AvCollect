/**
 * 自動清理的安全閘。
 *
 * 自動刪片仰賴「已收藏 / 已瀏覽 / 喜愛女優」當保護傘。
 * 2026-09-21 收藏全表被洗掉後，那層保護等於消失，一次清理就可能吃掉大半片庫。
 * 因此在刪除前先檢查保護訊號是否合理、單次刪除量是否過大；有疑慮就中止，等人確認。
 */

export interface CleanupStats {
  /** 片庫總數 */
  totalMovies: number;
  /** 目前收藏筆數（保護訊號） */
  favoritesCount: number;
  /** 目前點擊紀錄筆數（保護訊號） */
  viewedCount: number;
  /** 本次預計刪除的片數 */
  plannedDeletions: number;
}

export type CleanupDecision = { proceed: true } | { proceed: false; reason: string };

/** 單次刪除上限：全庫兩成。 */
export const CLEANUP_MAX_DELETE_RATIO = 0.2;
/** 小資料庫的固定額度，避免比例上限把正常汰換卡死。 */
export const CLEANUP_MIN_DELETE_ALLOWANCE = 20;
/** 低於這個規模的片庫還在草創期，沒有收藏 / 點擊紀錄屬正常。 */
export const CLEANUP_PROTECTION_REQUIRED_FROM = 50;

export const decideCleanup = (stats: CleanupStats): CleanupDecision => {
  const { totalMovies, favoritesCount, viewedCount, plannedDeletions } = stats;

  if (plannedDeletions <= 0) return { proceed: true };

  if (totalMovies >= CLEANUP_PROTECTION_REQUIRED_FROM) {
    if (favoritesCount === 0) {
      return {
        proceed: false,
        reason: `收藏清單為空但片庫有 ${totalMovies} 部，保護訊號可能已遺失，中止自動清理`,
      };
    }
    if (viewedCount === 0) {
      return {
        proceed: false,
        reason: `點擊紀錄為空但片庫有 ${totalMovies} 部，保護訊號可能已遺失，中止自動清理`,
      };
    }
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

export interface PurgeStats {
  /** 回收桶總筆數 */
  trashTotal: number;
  /** 本次超過保留期、預計永久移除的筆數 */
  expired: number;
}

/** 回收桶永久移除上限：一次最多清掉回收桶五成。 */
export const PURGE_MAX_RATIO = 0.5;

/**
 * 回收桶永久移除（purge）是整條清理流程裡唯一不可逆的一步。
 * 正常每次只會過期一天份（約回收桶 1/30）；過半同時過期代表時間單位寫錯、時鐘跳動等異常，中止等人確認。
 */
export const decidePurge = ({ trashTotal, expired }: PurgeStats): CleanupDecision => {
  if (expired <= 0) return { proceed: true };
  const allowance = Math.max(CLEANUP_MIN_DELETE_ALLOWANCE, Math.floor(trashTotal * PURGE_MAX_RATIO));
  if (expired > allowance) {
    return {
      proceed: false,
      reason: `回收桶有 ${expired} 部同時過期，超過安全額度 ${allowance} 部（回收桶共 ${trashTotal} 部），中止永久移除`,
    };
  }
  return { proceed: true };
};
