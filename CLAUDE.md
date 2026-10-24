# AvCollect 專案特定 AI 協作規範

## 專案常用指令
- **啟動開發伺服器**：`npm run dev`
- **專案建置**：`npm run build`
- **啟動生產伺服器**：`npm run start`
- **完成前驗證**：`npm run verify`（tsc + lint + 單元測試；CI 跑同一支，另加 build）

## PowerShell 執行規範
- **嚴禁使用 `&&` 串聯指令**：本機環境為 Windows PowerShell 5.1，不支援 `&&`。應改用 `;` 串聯，或以 `if ($?)` 判斷成功。

## 程式碼與架構規範
- **技術棧**：Next.js 15 App Router, Tailwind v4, Drizzle ORM, Turso (libSQL), TanStack Virtualizer
- **編譯與型別**：TS 專案 TypeScript 優先，維持型別定義的嚴格完整性與嚴格模式。

### 專案特定防禦守則
- **入口頁面**：`src/app/page.tsx`。

### 規則 ↔ 強制機制（被糾正時：修錯 + 補規則；規則已在表上卻沒機制擋 = 重犯，同一個 change 往上提層級）

| 規則 | 強制機制 |
|---|---|
| 讀取失敗不可回傳 `[]`／`{}`／`FALLBACK` 當預設值（2026-09-21 收藏洗空事故） | lint：`eslint.config.mjs` 的 `no-restricted-syntax`；測試：`src/lib/config.test.ts` |
| 清單類寫入（收藏、設定）只送 add/remove，禁止前端推整份清單覆蓋 | 架構：`favoritesWriteSchema`／`configWriteSchema` 拒收裸陣列，差異工具在 `src/lib/config-patch.ts`；測試：`src/app/api/config/route.test.ts`、`src/lib/validators.test.ts` |
| SSRF：圖片代理只放行白名單網域；`remotePatterns` 禁止萬用 `**` | 架構：唯一來源 `src/lib/image-proxy.ts` 的 `IMAGE_HOST_REFERERS`（新增圖床只改這裡）；測試：`src/lib/image-proxy.test.ts` |
| 禁止小於 10px 的微型字體（主要資訊最低 `text-xs`） | lint：`no-restricted-syntax`（`text-[Npx]`，N<10） |
| 本機、CI、Vercel 跑同一支驗證、同一版 Node | `npm run verify`（`.github/workflows/ci.yml` 呼叫同一支）；Node 版本唯一來源 `package.json` 的 `engines.node`（CI 用 `node-version-file`，Vercel 也讀它） |
| 詳情頁爬蟲選擇器改一邊必須同步 AvBatch `src/scrapers/detail-tags.ts` 並各補測試 | **無**（文件規則；兩邊已腐爛兩次，待比照 taste-core 做 sync/check） |
| 主要資訊是否該用 `text-xs`、`text-[10px]` 是否只用在次要徽章 | 判斷（文件規則） |
| Drizzle 操作一律 typed、零 SQL 字串拼接；API route 以 Zod 驗證 | 部分：tsc；字串拼接無 lint（判斷） |
| `SettingsView.tsx` 拆成 `TagEditor`、`BackfillCard` 等子元件並封裝持久化 | 判斷（文件規則） |

- **例外**寫在違規那一行上方，三樣缺一不可：`// eslint-disable-next-line no-restricted-syntax -- 原因｜到期 YYYY-MM-DD｜核准：<人>`。

## 🔄 專案關係與資料流 (Context & Data Flow)
- 本專案路徑為 [AvCollect](file:///C:/Users/c1471/Desktop/Projects/03.WebApps/AvCollect)
- 開發時應特別注意本專案在 `C:\Users\c1471\Desktop\Projects` 目錄架構下的權責劃分。
