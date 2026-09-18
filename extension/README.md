# AvCollect 背景開片助手 (Zero-Focus-Steal)

由於 Chrome/Edge 瀏覽器基於安全性沙箱限制，一般網頁 JavaScript 只要透過左鍵開啟分頁，瀏覽器就會硬性將焦點轉移至新分頁，且禁止網頁 JS 奪回焦點。

為了達成**「滑鼠左鍵點擊，影片在背景靜默開啟，AvCollect 完全不跳轉、不失焦」**的極致挑片體驗，請使用以下任一種方式（耗時不到 10 秒）：

---

## 方式 A：直接掛載 Chrome 擴充功能（最推薦，免裝任何第三方工具）

1. 打開 Chrome 或 Edge，於網址列輸入：
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. 開啟右上角的**「開發人員模式 (Developer mode)」**開關。
3. 點擊左上角的**「載入未封裝項目 (Load unpacked)」**按鈕。
4. 選擇本專案中的 `extension` 資料夾：
   `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\extension`
5. 回到 AvCollect 頁面重新整理（F5）。
🎉 **完成！以後隨便用左鍵點擊「前往觀看」，影片全部會在背景靜默打開，AvCollect 永遠維持在前景，彈窗自動關閉！**

---

## 方式 B：Tampermonkey 油猴腳本（若平常有使用油猴）

新增一個腳本，貼入以下代碼儲存即可：

```javascript
// ==UserScript==
// @name         AvCollect 背景開片助手
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在背景靜默開啟影片，焦點完全不離開 AvCollect
// @match        http://localhost:3000/*
// @match        http://127.0.0.1:3000/*
// @grant        GM_openInTab
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    window.__AVCOLLECT_EXT_INSTALLED__ = true;

    window.addEventListener('avcollect:open-background-tab', (e) => {
        if (e.detail && e.detail.url) {
            GM_openInTab(e.detail.url, { active: false, insert: true });
        }
    });

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('a[data-action="watch-external"]');
        if (btn && btn.href) {
            e.preventDefault();
            e.stopPropagation();
            GM_openInTab(btn.href, { active: false, insert: true });
            window.dispatchEvent(new CustomEvent('avcollect:close-modal'));
        }
    }, true);
})();
```
