/**
 * 設定清單（追蹤標籤、黑名單、喜愛女優、封鎖番號）的寫入指令格式。
 *
 * 比照收藏 2026-09-21 事故的修法：前端只送「加了什麼、刪了什麼」，
 * 後端以 DB 現況為底套用。前端底稿若因讀取失敗而是空的，
 * 也只會多加幾筆，不可能把既有項目洗掉。
 */
export interface ListDelta {
  add?: string[];
  remove?: string[];
}

/** 比對存檔前後的清單；沒有變化回 undefined（不送）。 */
export const diffList = (before: string[], after: string[]): ListDelta | undefined => {
  const prev = new Set(before);
  const next = new Set(after);
  const add = after.filter((v) => !prev.has(v));
  const remove = before.filter((v) => !next.has(v));
  if (add.length === 0 && remove.length === 0) return undefined;
  return { add, remove };
};

/** 以 current（DB 現況）為底套用差異：先移除、再補上尚未存在的新增項目。 */
export const applyListDelta = (current: string[], delta: ListDelta): string[] => {
  const removed = new Set(delta.remove ?? []);
  const kept = current.filter((v) => !removed.has(v));
  const seen = new Set(kept);
  for (const v of delta.add ?? []) {
    if (seen.has(v)) continue;
    seen.add(v);
    kept.push(v);
  }
  return kept;
};

/** 合併 debounce 期間累積的兩次差異，後到的意圖覆蓋先到的。 */
export const mergeListDelta = (
  prev: ListDelta | undefined,
  next: ListDelta
): Required<ListDelta> => {
  const add = new Set(prev?.add ?? []);
  const remove = new Set(prev?.remove ?? []);
  for (const v of next.add ?? []) {
    remove.delete(v);
    add.add(v);
  }
  for (const v of next.remove ?? []) {
    add.delete(v);
    remove.add(v);
  }
  return { add: [...add], remove: [...remove] };
};
