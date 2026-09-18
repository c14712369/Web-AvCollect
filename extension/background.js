// 監聽來自 content script 的背景開分頁請求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openBackgroundTab' && message.url) {
    // 調用瀏覽器特權 API：active: false 表示在背景靜默建立新分頁，不搶奪目前視窗焦點
    chrome.tabs.create(
      {
        url: message.url,
        active: false,
      },
      (tab) => {
        sendResponse({ success: true, tabId: tab?.id });
      }
    );
    return true; // 保持異步通訊通道
  }
});
