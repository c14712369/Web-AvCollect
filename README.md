# AvCollect

頂級數位資產典藏庫 — Next.js 15 + React 19 + Turso (libSQL) + Tailwind v4。

線上版：https://avcollect.vercel.app（需密碼登入）

## 技術棧

- **框架**：Next.js 15.5 (App Router) + React 19
- **資料庫**：Turso (libSQL/SQLite) + Drizzle ORM
- **狀態**：TanStack Query v5（含 optimistic updates）
- **樣式**：Tailwind CSS v4 (CSS-first `@theme`)
- **動畫**：Framer Motion v11
- **驗證**：Zod + t3-env
- **Auth**：自製 SHA-256 cookie session + Edge middleware
- **爬蟲**：Cheerio

## 與 AvBatch 的關係

AvCollect 與 AvBatch (`C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch`) **共用同一個 Turso 資料庫**：

- **AvBatch**（GitHub Actions 排程跑）：爬蟲後台 + Discord 通知 + 寫 movies table
- **AvCollect**（Vercel 線上版）：前台 UI + 收藏管理 + SSR 讀 movies table

完整協作指南請看 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 本地開發

```bash
npm install
cp .env.example .env.local
# 編輯 .env.local 填入 Turso URL + Token + APP_SECRET（≥8 字元）

npm run db:migrate   # 套用 schema 到 Turso
npm run db:seed      # （首次）載入 data.json / favorites.json
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)，輸入 `APP_SECRET` 密碼登入。

## 背景開啟影片

點擊影片卡片會在新分頁開啟原站。安裝 `extension/` 內的 Chrome / Edge 擴充功能後，新分頁會在背景建立，AvCollect 會保持在目前分頁且維持焦點；每次點擊只會建立一個分頁。

1. 開啟 `chrome://extensions` 或 `edge://extensions`。
2. 啟用「開發人員模式」，選擇「載入未封裝項目」。
3. 選取本專案的 `extension` 資料夾。
4. 回到 AvCollect 並重新整理頁面。

修改或更新 `extension/` 內容後，請在擴充功能管理頁按一次「重新載入」，再重新整理 AvCollect。完整安裝方式與 Tampermonkey 替代方案請見 [`extension/README.md`](extension/README.md)。

## 可用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動 dev server |
| `npm run build` | 生產 build |
| `npm run start` | 啟動 production server |
| `npm run lint` | ESLint flat config 檢查 |
| `npm test` | 執行 Node / TypeScript 測試 |
| `npm run db:generate` | 從 schema 變更產生 migration |
| `npm run db:migrate` | 執行 migration |
| `npm run db:studio` | 開啟 Drizzle Studio (瀏覽資料庫) |
| `npm run db:seed` | 將 JSON 資料載入資料庫 |

## 部署

已部署於 Vercel，連結 GitHub repo (`c14712369/Web-AvCollect`)，push 到 `master` 自動 production deploy。

環境變數（已設定在 Vercel）：
- `TURSO_DATABASE_URL` — Turso libSQL URL
- `TURSO_AUTH_TOKEN` — Turso auth token
- `APP_SECRET` — 登入密碼（≥8 字元）
- `GITHUB_REPO` — 觸發工作流程的 AvBatch repo（`c14712369/Batch-AvBatch`）
- `GITHUB_TOKEN` — GitHub token；最小權限為僅限目標 repo 的 **Actions: write**

部署 AvCollect 前，請先部署包含 workflow inputs 的 AvBatch 工作流程，否則 AvCollect 無法帶入參數觸發工作流程。

新環境部署：

```powershell
vercel link
vercel env add TURSO_DATABASE_URL production --value "libsql://..." --yes
vercel env add TURSO_AUTH_TOKEN production --value "ey..." --yes
vercel env add APP_SECRET production --value "your-secret" --yes
vercel env add GITHUB_REPO production --value "c14712369/Batch-AvBatch" --yes
vercel env add GITHUB_TOKEN production --value "github_pat_..." --yes
vercel deploy --prod --yes
```

## 鍵盤快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Cmd/Ctrl + K` | 聚焦搜尋框 |
| `F` | 切換「只看收藏」 |
| `Esc` | 關閉開啟中的對話框或卡片選單 |

## 主要功能

- 🔐 密碼登入保護（middleware + httpOnly cookie，30 天）
- 📚 約 350+ 部影片資料庫，由 AvBatch 自動補充
- 🔍 即時搜尋（番號、標題、女優名）
- 🎛️ 多維篩選（來源、分類、廠商、主題）
- ❤️ 收藏管理（樂觀更新 + 雲端持久化）
- 🕷️ 一鍵新增（Jable / MissAV / Javrate 自動爬蟲）
- 🖱️ 點擊卡片直接開啟原站；右鍵或長按顯示操作選單
- 🧭 搭配瀏覽器擴充功能在背景開片，AvCollect 維持聚焦
- 🌗 Light / Dark 主題切換
- 📦 收藏 JSON 匯入匯出
- ⚡ 24 部一頁的卡片格線與 URL 分頁
- 🎨 毛玻璃風格 + Framer Motion 動畫

## 專案結構

```
src/
  app/
    api/                    API routes (Drizzle 驅動 + Zod 驗證)
      auth/                 登入 / 登出
      favorites/            收藏 CRUD
      movies/               影片 CRUD + 爬蟲
      image-proxy/          跨域圖片代理
    page.tsx                Server Component (從 DB 抓資料)
    login/                  登入頁
    loading.tsx             骨架屏邊界
    error.tsx               錯誤邊界
    not-found.tsx           404 頁
    layout.tsx              Root layout + Providers
    providers.tsx           TanStack Query Provider
  components/
    HomeView.tsx            Client container（搜尋/篩選/state）
    Header.tsx              頂部欄（含 SearchInput / ThemeToggle / LogoutButton）
    MovieGrid.tsx           分頁卡片格線與操作選單狀態
    AvCard.tsx              影片卡片（點擊開片、右鍵/長按選單）
    CardContextMenu.tsx     卡片操作選單
    ImportExportDialog.tsx
    AddMovieDialog.tsx
    ThemeToggle.tsx
    LogoutButton.tsx
    FilterBar.tsx, SearchInput.tsx, Skeleton.tsx, ErrorBoundary.tsx
  hooks/
    useMovies.ts, useFavorites.ts, useTheme.ts, useKeyboardShortcuts.ts
  lib/
    db/
      schema.ts             Drizzle schema (movies + favorites)
      client.ts             libSQL client
      queries.ts            抽象查詢層
      seed.ts               JSON → SQLite 遷移
    auth.ts                 SHA-256 session helper（Edge runtime safe）
    env.ts                  t3-env 環境變數驗證
    validators.ts           Zod schemas
    metadata.ts             番號 → 製作商/主題/女優萃取
    open-movie.ts           背景分頁橋接與一般瀏覽器 fallback
    utils.ts                cn() helper
  middleware.ts             路由保護（攔截未登入）
  types/
    av.ts                   Movie interface
docs/
  ARCHITECTURE.md           AvBatch ↔ AvCollect 協作指南
  superpowers/plans/        歷史改造計畫
extension/                  Chrome / Edge 背景開片擴充功能
```
