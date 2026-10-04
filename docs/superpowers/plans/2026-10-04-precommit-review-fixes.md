# Pre-commit Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 AvBatch 與 AvCollect pre-commit review 的行為阻擋項，讓兩個 repo 通過完整驗證並可安全分批 commit。

**Architecture:** AvBatch 的來源去重只選擇內容來源，熱門榜訊號則跨來源合併；metadata 頁面識別以 base code 驗證，但資料列 identity 保留 `-U`。AvCollect 擴充功能只在自有網域執行。Schema 以 AvCollect 為 source of truth 同步至 AvBatch。

**Tech Stack:** TypeScript、Node test runner、Next.js 15、GitHub Actions、Drizzle ORM、Chrome Extension Manifest V3。

**Spec:** `docs/superpowers/plans/2026-10-04-metadata-enrichment-review-remediation.md` 與本次兩 repo Git diff review findings。

## Global Constraints

- 所有行為修復先寫會因現況失敗的測試，再修改 production code。
- 不刪除 `src/scheduler.ts.backup-20260920`；只讓 Git 忽略 `*.backup-*`。
- AvBatch DB/CAS identity 必須保留 `-U`，只能在頁面 identity 比對時轉成 base code。
- 不 commit、不 push；完成後只交付驗證結果與建議 commit 邊界。

---

### Task 1: 合併來源與熱門榜訊號

**Files:**
- Modify: `AvBatch/src/services/source-priority.test.ts`
- Modify: `AvBatch/src/services/source-priority.ts`

**Interfaces:**
- Consumes: 同番號的多個 `MovieItem`。
- Produces: 高優先來源的內容欄位，以及跨來源最強的熱門 `category`/`rank`。

- [ ] **Step 1: Write the failing test**

新增案例：Jable `New/rank 50` 與 MissAV `DailyHot/rank 0` 同番號時，輸出來源為 Jable，但 `category/rank` 保留 `DailyHot/0`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/services/source-priority.test.ts`

Expected: FAIL，實際仍為 `New/rank 50`。

- [ ] **Step 3: Write minimal implementation**

選來源與選熱門訊號分開；只在候選具有 `DailyHot`、`WeeklyHot`、`MonthlyHot` 且 rank 更小時覆蓋 `category/rank`。

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npx tsx --test src/services/source-priority.test.ts`

Expected: PASS。

### Task 2: 支援無碼 `-U` 頁面 identity

**Files:**
- Modify: `AvBatch/src/scrapers/detail-tags.test.ts`
- Modify: `AvBatch/src/scrapers/detail-tags.ts`

**Interfaces:**
- Consumes: DB code `FNS-098-U`、頁面 title `FNS-098`、canonical slug `fns-098-uncensored-leak`。
- Produces: 通過 identity 驗證的 metadata；其他 suffix 或錯片仍拒絕。

- [ ] **Step 1: Write the failing test**

新增 MissAV/Jable fixtures：`expectedCode=FNS-098-U` 應接受 base title 與 `-uncensored-leak` canonical，拒絕有碼 canonical；非 `-U` row 也必須拒絕無碼 canonical。另驗證 `MIDA-007A` 這類數字後直接接英文字尾的合法番號。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/scrapers/detail-tags.test.ts`

Expected: FAIL，metadata 為空。

- [ ] **Step 3: Write minimal implementation**

新增頁面 identity 專用 normalization：比對 base code，同時要求 expected 的 `-U` 與 URL 的 `-uncensored-leak` 方向一致；番號 parser 接受數字後直接接英文字尾；不修改 row code。

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npx tsx --test src/scrapers/detail-tags.test.ts`

Expected: PASS。

### Task 3: 收斂擴充功能權限與補部署文件

**Files:**
- Modify: `AvCollect/extension/manifest.json`
- Modify: `AvCollect/README.md`

**Interfaces:**
- Consumes: production URL `https://avcollect.vercel.app/*` 與 localhost。
- Produces: content script 只在 AvCollect 頁面載入；README 列出 GitHub workflow dispatch 所需環境變數。

- [ ] **Step 1: Restrict extension hosts**

將 `host_permissions` 與 content-script `matches` 的 `https://*/*` 改成 `https://avcollect.vercel.app/*`，保留兩個 localhost pattern。

- [ ] **Step 2: Document deployment variables**

在 README 的部署環境變數與 Vercel 指令加入 `GITHUB_REPO`、`GITHUB_TOKEN`，說明最小 Actions write 權限與先部署 AvBatch。

- [ ] **Step 3: Validate the artifact**

Run: `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"`

Expected: exit 0；manifest 中不存在 `https://*/*`。

### Task 4: Schema 與 Git hygiene

**Files:**
- Modify: `AvBatch/src/db/schema.ts`
- Modify: `AvBatch/.gitignore`

**Interfaces:**
- Consumes: AvCollect canonical schema。
- Produces: `npm run check-schema` 通過，`*.backup-*` 不再出現在 Git status。

- [ ] **Step 1: Back up and synchronize schema**

Run: `npm run sync-schema`

Expected: AvBatch schema 與 AvCollect source of truth 一致。

- [ ] **Step 2: Ignore dash-style backups**

在 `.gitignore` 加入 `*.backup-*`，不刪除既有備份。

- [ ] **Step 3: Verify both repositories**

AvBatch：`npm test`、`npm run typecheck`、`npm run build`、`npm run check-schema`、`npm run check-taste`、`git diff --check`。

AvCollect：`npm test`、`npm run lint`、`npx tsc --noEmit --incremental false`、`npm run build`、`git diff --check`。
