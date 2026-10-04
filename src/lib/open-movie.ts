import type { Movie } from '@/types/av';

type AvCollectWindow = Window & { __AVCOLLECT_EXT_INSTALLED__?: boolean };

/**
 * 擴充功能以 DOM attribute 標記自己，避免 page-world script 被 CSP 阻擋時
 * 網頁誤走 window.open，造成背景分頁與前景分頁各開一次。
 */
export function hasBackgroundTabBridge(browserWindow: Window) {
  const avCollectWindow = browserWindow as AvCollectWindow;
  return (
    avCollectWindow.__AVCOLLECT_EXT_INSTALLED__ === true ||
    browserWindow.document.documentElement?.getAttribute('data-avcollect-background-tabs') === 'true'
  );
}

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
  const handledByBridge = !window.dispatchEvent(
    new CustomEvent('avcollect:open-background-tab', {
      detail: { url: movie.url },
      cancelable: true,
    })
  );
  if (handledByBridge || hasBackgroundTabBridge(window)) return;
  window.open(movie.url, '_blank', 'noopener,noreferrer');
}
