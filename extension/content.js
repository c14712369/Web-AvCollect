// DOM attribute 可跨 Chrome isolated world，且不會被網站的 CSP 擋下。
document.documentElement?.setAttribute('data-avcollect-background-tabs', 'true');

// 保留舊版網頁使用的 page-world 標記。
try {
  const script = document.createElement('script');
  script.textContent = 'window.__AVCOLLECT_EXT_INSTALLED__ = true;';
  (document.head || document.documentElement).appendChild(script);
  script.remove();
} catch (e) {
  console.warn('[AvCollect Ext] injection warning:', e);
}

// 監聽網頁派發的自定義事件
window.addEventListener('avcollect:open-background-tab', (e) => {
  if (e.detail && e.detail.url) {
    // 同步回覆網頁端「已由擴充功能接手」，避免它再走 window.open fallback。
    e.preventDefault();
    chrome.runtime.sendMessage({
      action: 'openBackgroundTab',
      url: e.detail.url,
    });
  }
});

// 在捕獲階段攔截所有 [data-action="watch-external"] 點擊
document.addEventListener(
  'click',
  (e) => {
    const btn = e.target.closest('a[data-action="watch-external"]');
    if (btn && btn.href) {
      e.preventDefault();
      e.stopPropagation();

      chrome.runtime.sendMessage({
        action: 'openBackgroundTab',
        url: btn.href,
      });

      // 通知頁面關閉 Modal
      window.dispatchEvent(new CustomEvent('avcollect:close-modal'));
    }
  },
  true
);
