import { z } from 'zod';

export const addMovieSchema = z.object({
  url: z.string().url('必須是合法網址'),
});

export type AddMovieInput = z.infer<typeof addMovieSchema>;

/**
 * 收藏寫入指令。
 * 單筆增刪（add/remove）供 UI toggle 使用；整份覆蓋（replace）只給匯入功能，
 * 必須明確宣告 op，避免像 2026-09-21 那樣「送出推論來的空清單」就洗掉全表。
 */
export const favoritesWriteSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), code: z.string().min(1) }),
  z.object({ op: z.literal('remove'), code: z.string().min(1) }),
  z.object({ op: z.literal('replace'), codes: z.array(z.string().min(1)) }),
]);

export type FavoritesWriteInput = z.infer<typeof favoritesWriteSchema>;

const tagItem = z.string().trim().min(1).max(30);
const prefixItem = z.string().trim().min(1).max(20).regex(/^[A-Z0-9]+$/i);
const actressItem = z.string().trim().min(1).max(40);

/** 清單只收 add/remove 差異；裸陣列（整份覆蓋）會被 strict object 擋下。 */
const listDelta = (item: z.ZodString, max: number) =>
  z.strictObject({
    add: z.array(item).max(max).optional(),
    remove: z.array(item).max(max).optional(),
  });

/**
 * 設定寫入指令。
 * 清單類比照收藏只接受差異，後端以 DB 現況為底套用（見 src/lib/config-patch.ts）；
 * makerMap 是「只補/改傳入的 prefix」的 merge patch。
 */
export const configWriteSchema = z.object({
  trackedTags: listDelta(tagItem, 300).optional(),
  blockedTags: listDelta(tagItem, 300).optional(),
  blockedIssuers: listDelta(prefixItem, 500).optional(),
  preferredActresses: listDelta(actressItem, 500).optional(),
  makerMap: z.record(prefixItem, z.string().trim().min(1).max(40)).optional(),
});

export type ConfigWriteInput = z.infer<typeof configWriteSchema>;
