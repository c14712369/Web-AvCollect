# AvCollect

頂級數位資產典藏庫 — Next.js 15 + React 19 + Turso (libSQL) + Tailwind v4。

## 技術棧

- **框架**：Next.js 15.1 (App Router) + React 19
- **資料庫**：Turso (libSQL/SQLite) + Drizzle ORM
- **狀態**：TanStack Query v5
- **虛擬化**：@tanstack/react-virtual
- **樣式**：Tailwind CSS v4 (CSS-first `@theme`)
- **動畫**：Framer Motion v11
- **驗證**：Zod + t3-env
- **爬蟲**：Cheerio

## 本地開發

```bash
# 1. 安裝依賴
npm install

# 2. 建立環境變數（本地用 SQLite 檔案）
cp .env.example .env.local
# 編輯 .env.local，將 TURSO_DATABASE_URL 設為 file:./local.db

# 3. 初始化資料庫
npm run db:migrate

# 4. 載入種子資料（從 src/lib/data.json + favorites.json）
npm run db:seed

# 5. 啟動 dev server
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

## 可用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動 dev server |
| `npm run build` | 生產 build |
| `npm run start` | 啟動 production server |
| `npm run db:generate` | 從 schema 變更產生 migration |
| `npm run db:migrate` | 執行 migration |
| `npm run db:studio` | 開啟 Drizzle Studio (瀏覽資料庫) |
| `npm run db:seed` | 將 JSON 資料載入資料庫 |

## 部署到 Vercel

### 1. 建立 Turso 雲端資料庫

```bash
# 安裝 Turso CLI
npm install -g @turso/cli

# 登入（會開瀏覽器）
turso auth login

# 建立資料庫
turso db create avcollect

# 取得連線資訊
turso db show avcollect --url
turso db tokens create avcollect
```

### 2. 將 schema 與資料同步到雲端

更新 `.env.local`，把 `TURSO_DATABASE_URL` 改為剛取得的 `libsql://` URL，並填入 `TURSO_AUTH_TOKEN`。然後執行：

```bash
npm run db:migrate
npm run db:seed
```

### 3. 部署 Vercel

```bash
npm install -g vercel
vercel login
vercel link

# 設定環境變數
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add TURSO_DATABASE_URL preview
vercel env add TURSO_AUTH_TOKEN preview

# 部署
vercel --prod
```

## 鍵盤快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Cmd/Ctrl + K` | 聚焦搜尋框 |
| `F` | 切換「只看收藏」 |
| `Esc` | 關閉開啟中的 Modal |

## 主要功能

- 📚 約 200+ 部影片資料庫
- 🔍 即時搜尋（番號、標題、女優名）
- 🎛️ 多維篩選（來源、分類、廠商、主題）
- ❤️ 收藏管理（樂觀更新 + 雲端持久化）
- 🕷️ 一鍵新增（Jable / MissAV / Javrate 自動爬蟲）
- 🖼️ 影片詳情 Modal（含主題標籤）
- 🌗 Light / Dark 主題切換
- 📦 收藏 JSON 匯入匯出
- ⚡ 虛擬化卡片格線（@tanstack/react-virtual）
- 🎨 毛玻璃風格 + Framer Motion 動畫

## 專案結構

```
src/
  app/
    api/                  API routes (Drizzle 驅動)
    page.tsx              Server Component (從 DB 抓資料)
    loading.tsx           骨架屏邊界
    error.tsx             錯誤邊界
    not-found.tsx         404 頁
    layout.tsx            Root layout + Providers
    providers.tsx         TanStack Query Provider
  components/
    HomeView.tsx          Client container（搜尋/篩選/state）
    Header.tsx            頂部欄
    MovieGrid.tsx         虛擬化格線
    AvCard.tsx            影片卡片
    MovieDetailModal.tsx  詳情 Modal
    ImportExportDialog.tsx
    AddMovieDialog.tsx
    ThemeToggle.tsx
    FilterBar.tsx, SearchInput.tsx, Skeleton.tsx, ErrorBoundary.tsx
  hooks/
    useMovies.ts, useFavorites.ts, useTheme.ts, useKeyboardShortcuts.ts
  lib/
    db/
      schema.ts           Drizzle schema (movies + favorites)
      client.ts           libSQL client
      queries.ts          抽象查詢層
      seed.ts             JSON → SQLite 遷移
    env.ts                t3-env 環境變數驗證
    validators.ts         Zod schemas
    metadata.ts           番號 → 製作商/主題/女優萃取
    utils.ts              cn() helper
  types/
    av.ts                 Movie interface
```

## 改進歷程

本 commit 系列（feat/overhaul branch）將專案從檔案型 JSON prototype 升級為生產級 PWA：

- **資料層**：JSON → Turso (libSQL) + Drizzle ORM
- **狀態**：自訂 listener pattern → TanStack Query (含 optimistic updates)
- **效能**：212 行 page.tsx → 9 行 Server Component + 虛擬化格線
- **健壯性**：補齊 loading/error/not-found 邊界、Skeleton、ErrorBoundary
- **UX**：詳情 Modal、主題切換、鍵盤快捷鍵、匯入匯出、自訂 Dialog 取代 window.prompt
- **部署**：Vercel + GitHub Actions CI（型別檢查 + build）
