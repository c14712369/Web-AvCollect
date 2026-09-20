import type { Movie } from '@/types/av';

export type SortOption = 'added' | 'actress' | 'maker';
export type SortDirection = 'asc' | 'desc';

const compareText = (left: string, right: string, direction: SortDirection) => {
  const result = left.localeCompare(right, 'zh-Hant');
  return direction === 'asc' ? result : -result;
};

/** 影片牆排序：沒有對應欄位的項目始終排在最後。 */
export function sortMovies(movies: Movie[], option: SortOption, direction: SortDirection): Movie[] {
  return [...movies].sort((left, right) => {
    if (option === 'added') {
      const leftDate = left.addedAt ?? '';
      const rightDate = right.addedAt ?? '';
      if (!leftDate && !rightDate) return 0;
      if (!leftDate) return 1;
      if (!rightDate) return -1;
      return compareText(leftDate, rightDate, direction);
    }

    const leftValue = option === 'actress' ? left.actress ?? '' : left.maker;
    const rightValue = option === 'actress' ? right.actress ?? '' : right.maker;
    if (!leftValue && !rightValue) return 0;
    if (!leftValue) return 1;
    if (!rightValue) return -1;
    return compareText(leftValue, rightValue, direction);
  });
}
