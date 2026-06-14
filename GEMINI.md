# AvCollect 專案特定 AI 協作規範

## 專案常用指令
- **啟動開發伺服器**：`npm run dev`
- **專案建置**：`npm run build`
- **啟動生產伺服器**：`npm run start`

## PowerShell 執行規範
- **嚴禁使用 `&&` 串聯指令**：本機環境為 Windows PowerShell 5.1，不支援 `&&`。應改用 `;` 串聯，或以 `if ($?)` 判斷成功。

## 程式碼與架構規範
- **技術棧**：Next.js 15 App Router, Tailwind v4, Drizzle ORM, Turso (libSQL), TanStack Virtualizer
- **編譯與型別**：TS 專案 TypeScript 優先，維持型別定義的嚴格完整性與嚴格模式。

### 專案特定防禦守則
- **入口頁面**：`src/app/page.tsx`。
- **⚠️ SSRF 防禦 (CRITICAL)**：`/api/image-proxy` 路由必須實施 Target 域名白名單限制（只允許 Jable/MissAV 等官方 CDN），防範內網與 Metadata 探測。
- **圖片域名限制**：`next.config.ts` 中的 `images.remotePatterns` 應改為具體 hostname 白名單，禁止使用萬用 `**`。
- **⚠️ UI 規範符合 (HIGH)**：`AvCard.tsx` 等主要資訊卡片，嚴禁使用 `text-[8px]` / `text-[9px]` 微型字體，文字主要資訊最低限度應為 `text-xs`，以確保行動端可讀性。
- **代碼拆分**：`SettingsView.tsx` 應拆分為 `TagEditor`、`BackfillCard` 等子元件，並封裝持久化 logic。
- **型別安全**：Drizzle ORM 所有 DB 操作均需 typed，零 SQL 字串拼接，防範 SQL injection；API route 使用 Zod Schema 驗證。

## 🔄 專案關係與資料流 (Context & Data Flow)
- 本專案路徑為 [AvCollect](file:///C:/Users/c1471/Desktop/Projects/03.WebApps/AvCollect)
- 開發時應特別注意本專案在 `C:\Users\c1471\Desktop\Projects` 目錄架構下的權責劃分。
