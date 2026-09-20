/** 首頁穩定後再預抓，避免與首次內容載入競爭網路資源。 */
export const UPCOMING_PREFETCH_DELAY_MS = 1200;

export function shouldFetchUpcoming(isIdle: boolean, isUpcomingVisible: boolean): boolean {
  return isIdle || isUpcomingVisible;
}
