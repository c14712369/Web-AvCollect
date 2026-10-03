import type { Movie } from '@/types/av';

/** 記錄已點進去過的影片（避免兩週後被視為未讀清理）。 */
function recordViewed(code: string) {
  fetch('/api/movies/viewed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).catch((err) => console.warn('Record view failed:', err));
}

/**
 * 在新分頁開啟影片原站。
 * 有裝 AvCollect 擴充功能/油猴腳本時交給它在背景靜默開分頁，否則走 window.open。
 */
export function openMovieExternally(movie: Movie) {
  if (!movie.url) return;
  recordViewed(movie.code);
  window.dispatchEvent(
    new CustomEvent('avcollect:open-background-tab', { detail: { url: movie.url } })
  );
  if ((window as Window & { __AVCOLLECT_EXT_INSTALLED__?: boolean }).__AVCOLLECT_EXT_INSTALLED__) return;
  window.open(movie.url, '_blank', 'noopener,noreferrer');
}
