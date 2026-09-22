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
