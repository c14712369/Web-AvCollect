// 注入標記以供網頁端感知擴充功能已啟動
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
