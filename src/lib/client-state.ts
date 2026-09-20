/** 將 API 序列化後的日期字串與 SSR 的 Date 統一成 ISO timestamp。 */
export function toIsoTimestamp(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

/** 從網址讀取安全的 1 起算分頁。 */
export function pageFromSearchParam(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
