# AvCollect / AvBatch 待辦清單

> 最後更新：2026-05-21
> 範圍：兩個專案（AvCollect 為主，相關 AvBatch 改動也列入）

---

## 🔥 高優先 (Next)

### 1. Release Date 實際抓取
目前 schema/UI 已支援 `release_date`，但 AvBatch scraper 沒實際抓。新片進來 `release_date` 都是 NULL。

**做法**：scraper 在 list page 抓到 movie 後，並行 fetch detail page 抓發行日。預期工作：
- [ ] Jable: `scrapers/jable.ts` 加 `fetchReleaseDate(detailUrl)` (selector 待 inspect)
- [ ] MissAV: 同上（`<time>` 或 `<div class="text-secondary">`）
- [ ] Javrate: 同上
- [ ] 並行控制（限 concurrency 5，避免被 ban）
- [ ] Backfill 既有 357 部影片（一次性 script）

預期成本：每個 source 寫 + 測試 ~30 分；backfill ~5-10 分鐘執行。

---

### 2. Settings UI 圖形介面改 config
目前要改 `tracked_tags` / `preferred_actresses` 等只能：
- (a) 寫 SQL `UPDATE app_config SET value=...`
- (b) 開 `npm run db:studio`

兩種都不夠日常。建議在 AvCollect 加 `/settings` 頁：
- [ ] 路由：`/settings`（已被 middleware 保護）
- [ ] UI：每個 config key 一個區塊（tag chips / actress list editor / maker map editor）
- [ ] 儲存：POST `/api/config/[key]` → 寫 `app_config` 並 `invalidateConfigCache()`
- [ ] 新增 / 移除 tag 即時生效，無需 redeploy

**ROI 最高**：之後改 filter 不需動 code、不需 git push。

---

### 3. 防暴力破解登入
目前 `/api/auth/login` 無 rate limit，理論上可以暴力試密碼。
雖然 `APP_SECRET` 32 字元 base64 不太可能破，但好習慣。

- [ ] 加 IP-based rate limit（10 次/分鐘）
- [ ] 用 Upstash Redis 或 Vercel KV（免費額度夠）
- [ ] 或更簡單：用 Turso 一張小 table 紀錄 attempts

---

## 🌿 中優先 (Someday)

### 4. AvBatch 加更多 source
- [ ] DMM (https://www.dmm.co.jp)
- [ ] FANZA
- [ ] 7mmtv / supjav 等備援站
- [ ] 統一介面：每個 source 一個 file 實作 `scrape(url): Promise<MovieItem[]>`

### 5. AvBatch 改用 Drizzle ORM
目前 `turso.ts` 用 raw SQL，schema 一變兩邊都要改。

- [ ] AvBatch 也 npm install drizzle-orm
- [ ] 從 AvCollect 複製 / symlink `schema.ts`（或抽成 npm workspace）
- [ ] turso.ts 全面改 Drizzle 查詢

### 6. 互動式 Discord 指令
TODO.md 原本就有：
- [ ] `/add_tag <tag>` → 加入 `tracked_tags`
- [ ] `/add_actress <name>` → 加入 `preferred_actresses`
- [ ] `/check_now` → 觸發 immediate scrape
- [ ] `/stats` → 顯示資料庫總筆數、最近新增

實作要走 Discord Bot 真正的 socket（不是 webhook），AvBatch 已 install `discord.js` 但目前只用 WebhookClient。

### 7. PWA Install 完整流程
- [ ] 製作 icon-192.png, icon-512.png（目前 manifest 指 `/icon.*` 不存在）
- [ ] Service Worker（offline 顯示快取的影片列表）
- [ ] iOS Safari「加到主畫面」測試

---

## 🍂 低優先 / 未來考慮 (Parking Lot)

### 8. AI 標題理解
目前用 regex 萃取廠商/女優/主題，準確度有限：
- 「日向夏」可能不是真名末尾
- 主題 keyword match 過於粗糙

未來可加：
- 用 LLM API 解析每部影片標題 → 結構化 metadata
- 結果寫 `app_config.title_parse_overrides` 表
- 成本：每次新增影片 1 次 API call

### 9. 多使用者支援
目前單一密碼 = 單一使用者。未來如果想多人用：
- 切換到 NextAuth + 真正帳戶系統
- `favorites` table 加 `user_id` FK
- 多人 share 同一個 movies pool

### 10. Backup / Disaster Recovery
- [ ] 每週自動 dump Turso → S3 / GDrive
- [ ] Cron 用 GitHub Actions 即可

### 11. Observability
- [ ] Sentry / Bugsnag for AvCollect error tracking
- [ ] AvBatch 跑失敗發 Discord 警告（目前已有 success/empty 通知，缺 error 通知）

### 12. CSP / Security Headers
- [ ] `next.config.ts` 加 strict CSP
- [ ] X-Frame-Options, Referrer-Policy 等

### 13. 改 token rotation 提示
- [ ] 每 6 個月 GitHub Actions 自動發 Discord 提醒 rotate Turso token

### 14. 改 ESLint / 補 Prettier
- [ ] 目前 ESLint 只有 `@next/next` 規則
- [ ] 加 `@typescript-eslint` strict + `prettier` format on commit (husky)

### 15. 詳情頁 SEO 與 OG 圖
- [ ] `/actress/[name]` 加 `generateMetadata` 動態產生 OG 圖
- [ ] 分享連結到 Discord / LINE 自動顯示女優卡

### 16. 統計儀表板
- [ ] `/stats` 路由
- [ ] 各廠商作品數、各女優作品數、收藏分佈
- [ ] 用 Recharts 或 Tremor

---

## ⚠️ 已知 Issue

| ID | 說明 | 影響 |
|----|------|------|
| #1 | `feat/overhaul` branch 已被 merge 但未刪除 | 低（git history 略亂） |
| #2 | Vercel `feat/overhaul` preview env vars 仍掛在該 branch | 低（branch 已死） |
| #3 | AvCollect lockfile 不入 git，CI 用 `npm install` 而非 `npm ci` | 中（版本可能漂移） |
| #4 | `manifest.webmanifest` 指向 `/icon-192.png` 等不存在的檔案 | 低（PWA install 圖會空白） |
| #5 | `next.config.ts` 允許所有 https remotePatterns | 中（安全建議鎖白名單） |

---

## ✅ 已完成 (歷史紀錄)

最近大改動，按時間倒序：

- ✅ **共用 config + release_date 欄位** (2026-05-21)
  - 新 `app_config` table，metadata.ts 改用動態 config
  - movies 加 release_date 欄位 + UI 排序
- ✅ **Turso token rotation** (2026-05-21)
  - 6 個位置同步更新（本地 x3、Vercel x2、GitHub Actions x1）
- ✅ **AvBatch 串接 Turso** (2026-05-21)
  - 廢除 notified.json / gallery.json / public/index.html
  - 與 AvCollect 共用同一個 Turso
- ✅ **Auth (密碼登入)** (2026-05-21)
  - middleware + SHA-256 cookie session + login page
- ✅ **Actress 詳情頁** (2026-05-20)
  - `/actress/[name]` 聚合同女優作品
- ✅ **UI 修正三件套** (2026-05-20)
  - 主題只顯示追蹤標籤 / 廠商過濾未知 / Modal 圖片升級
- ✅ **AvCollect 全方面改造** (2026-05-20)
  - JSON → Turso、Server Component、虛擬化、TanStack Query、auth、deployed Vercel

---

## 📌 開發守則 (給自己 / 給 Claude)

1. **共用設定改 Turso，不改 hardcode**：再也不要把 `tracked_tags` 寫死進 metadata.ts
2. **Schema 變更先 AvCollect 後 AvBatch**：AvCollect `db:generate` + `db:migrate`，再去改 AvBatch turso.ts
3. **Token 不要再貼 chat**：未來 rotate 自己跑 `vercel env add` + `gh secret set`，參考 ARCHITECTURE.md
4. **commit 訊息用繁體中文**：feat/fix/refactor/chore/docs/ci/test 開頭
5. **每次大改後**：跑 `npx tsc --noEmit && npm run lint && npm run build` 三件套
