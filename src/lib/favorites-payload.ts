/**
 * 收藏寫入的指令格式。
 *
 * 2026-09-21 事故：toggle 以「整份清單覆蓋」寫入，後端 setFavorites 是
 * `delete 全表 + 重新 insert`；當 favorites query 尚未載入（或載入失敗）時，
 * 用 `?? []` 推論出的空清單會把整張表洗成單筆。
 * 因此 toggle 一律只送單筆增刪，讓「刪掉其他人的收藏」在結構上不可能發生。
 */
export type FavoriteDelta =
  | { op: 'add'; code: string }
  | { op: 'remove'; code: string };

/** 由「這部片目前是否已收藏」決定要送的單筆指令。 */
export const buildTogglePayload = (code: string, isFavorite: boolean): FavoriteDelta => ({
  op: isFavorite ? 'remove' : 'add',
  code,
});

/**
 * 算出樂觀更新後的本地清單。
 * current 為 undefined（尚未載入/載入失敗）時視為「未知」，只動自己這一筆。
 */
export const applyFavoriteDelta = (
  current: string[] | undefined,
  delta: FavoriteDelta
): string[] => {
  const list = current ?? [];
  if (delta.op === 'remove') return list.filter((c) => c !== delta.code);
  return list.includes(delta.code) ? list : [...list, delta.code];
};
