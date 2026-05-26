# 番號 Prefix 管理 + 三項延伸 — 設計文件

**日期**：2026-05-26
**範圍**：AvCollect + AvBatch（兩 repo 都動）
**狀態**：草案，待 user review

---

## 1. 動機

使用者反映：「SOD 我只想追蹤 START，其他 SDMM / STARS / SDJS 都不要」。

### 現況侷限
- `app_config.maker_map`：prefix → 廠商，只用於 UI 顯示。
- `app_config.preferred_issuers`：扁平 prefix 白名單，**只影響評分 baseline（+25 軟加分）**。
- `app_config.blocked_issuers`：硬閘門已掛在 `AvBatch/src/scheduler.ts:103`（命中即 skip，不寫 DB、不推播），**但目前是空陣列且沒有 UI**。
- 結果：無法以番號粒度禁止追蹤，只能整廠商封鎖或調權重。

### 目標
1. **核心**：UI 能依廠商分組管理 prefix；勾選 = 追蹤、未勾 = 寫入 `blocked_issuers` 硬擋。
2. **延伸 A（女優豁免）**：被擋的 prefix 若命中追蹤女優，仍放行（與 `blocked_tags` 同邏輯，女優優先）。
3. **延伸 B（為什麼?）**：影片 Modal 加可展開段，顯示完整評分明細與是否被閘門攔截。
4. **延伸 C（一鍵 Backfill）**：Settings 加按鈕，透過 GitHub API 觸發 AvBatch 的 `backfill-tags` workflow。

### 非目標
- 不刪除既有 `preferred_issuers`（仍作為軟加分 baseline）。
- 不調整 `maker_map` 既有對應；只允許「新增」prefix→maker 對應。
- 不對舊片做大規模回溯刪除；用戶語意：「**舊資料不管，新資料不爬、不推**」。
- backfill 不做即時 SSE 進度條（複雜度過高），只給 GHA 連結。

---

## 2. 資料模型

不動 schema，全部用既有 `app_config` 表。

| Key | 型別 | 角色 | 本次 |
|---|---|---|---|
| `maker_map` | `Record<prefix, maker>` | 顯示用、UI 反轉分組 | **可新增 entry**（廠商既有清單擴充） |
| `blocked_issuers` | `string[]`（prefix 大寫） | 硬閘門（scheduler skip） | **新增 UI 寫入** |
| `preferred_issuers` | `string[]`（prefix 大寫） | 軟加分 baseline | 不動 |

**反轉邏輯（前端）**
```ts
// makerGroups: { [maker: string]: string[] }（prefix 排序、廠商按字母）
function groupByMaker(map: Record<string, string>) {
  const out: Record<string, string[]> = {};
  for (const [prefix, maker] of Object.entries(map)) {
    (out[maker] ??= []).push(prefix);
  }
  for (const list of Object.values(out)) list.sort();
  return out;
}
```

`isBlocked(prefix)` = `blockedIssuers.includes(prefix.toUpperCase())`。

---

## 3. 元件結構

### 3.1 後端 API（AvCollect）

**`src/app/api/config/route.ts`** — 擴充 schema：
```ts
const schema = z.object({
  trackedTags: tagArray.optional(),
  blockedTags: tagArray.optional(),
  blockedIssuers: z.array(z.string().trim().min(1).max(20).regex(/^[A-Z0-9]+$/i)).max(500).optional(),
  makerMap: z.record(z.string().min(1), z.string().min(1)).optional(),
});
```
- POST 收 `blockedIssuers` → 大寫去重後 `setConfigArray('blocked_issuers', ...)`。
- POST 收 `makerMap` → **merge**（不是覆蓋）後寫入 `setConfigObject('maker_map', ...)`（新增 `queries.setConfigObject` helper）。
- `invalidateConfigCache()` 後回最新值。

**`src/lib/db/queries.ts`** — `getTagSettings()` 擴充回傳：
```ts
{ trackedTags, blockedTags, blockedIssuers, makerMap, suggestions }
```

### 3.2 前端 UI（AvCollect）

**新元件**：`src/components/MakerPrefixManager.tsx`
- 鑲在 `SettingsView.tsx`，置於既有「封鎖標籤」之下。
- Props：`makerMap: Record<string, string>`、`blockedIssuers: string[]`、`onSave(patch: { blockedIssuers?: string[]; makerMap?: Record<string, string> })`。
- 狀態樂觀更新：toggle chip → 立即更新 local state → 背景 POST → 失敗回滾並 toast。
- 視覺：
  - 廠商卡片：`glass-card rounded-2xl p-4`，標題 `text-lg font-semibold`，右側「全選 / 全清」小按鈕。
  - prefix chip：圓角 pill，已勾 `bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40`，未勾 `bg-zinc-800/50 text-zinc-500 line-through`。
  - 廠商超過 8 prefix 摺疊「顯示更多 N」。
  - 廠商卡按字母排序，「未知廠商」（空字串 maker）排最後。
- 新增 prefix 區（卡片下方）：input + 廠商 datalist（沿用既有清單）+ 「加入」按鈕。送出寫入 `makerMap`，新 prefix 預設未勾（= 追蹤）。

### 3.3 Scheduler 女優豁免（AvBatch）

**`src/scheduler.ts`** 改動點（行 103 附近）：
```ts
// 黑名單最終把關（最優先，命中即跳過、不浪費評分）
if (filters.blockedIssuers.includes(issuer)) {
  // 女優豁免：與 blocked_tags 同邏輯，命中追蹤女優視為「使用者明確想看」
  const exempt = filters.preferredActresses.some((name) => movie.title.includes(name));
  if (!exempt) continue;
  // 命中→繼續往下評分。後續若 actressMatched 自然歸 ActressMatched 分類。
}
```
- 不需要 sync 給 AvCollect（AvCollect 不走 scheduler 邏輯）。
- 風險：若標題裡的女優其實是 AI 抓錯的字串，會誤豁免。可接受（與 blocked_tags 同水準）。

### 3.4 評分明細「為什麼?」（AvCollect + 共用 core）

**`src/lib/taste/core.ts`** — 擴充 `MatchResult`（向後相容，新欄位 optional）：
```ts
export interface MatchBreakdown {
  actress: { hit: string | null; score: number };  // 例：{ hit: '河北彩伽', score: 60 }
  issuer: { hit: string | null; score: number };
  themes: { hits: string[]; score: number };
}

export interface MatchResult {
  score: number;
  tier: MatchTier;
  reasons: string[];
  breakdown?: MatchBreakdown;  // 新增；舊呼叫端可忽略
}
```
`classify()` 內部累加時填 breakdown。AvBatch 必須 `npm run sync-taste`。

**重要**：`breakdown` **不需要持久化**到 DB。AvCollect 的 `queries.listMovies` 已是即時建 profile + `classify()`（見 [[taste-scoring-engine]]），把 breakdown 一起回傳即可。AvBatch 端 scheduler 不用 breakdown（Discord 通知只用 reasons），所以 DB schema 完全不動。

**`src/components/MovieDetailModal.tsx`** — 既有「命中原因」段下方加可展開段：
```
🔍 完整評分明細  [▼]
─────────────────
🎀 女優：河北彩伽 +60
🏷️ 廠商：SSIS +25 （在追蹤清單）
🏷️ 標籤：校服 +10 （命中 1 個）
總分 95 → 🎯 為你推薦
─────────────────
✓ 番號 SSIS 不在黑名單
✓ 未命中任何封鎖標籤
```
- 若該片的 issuer 在 `blockedIssuers` 內，顯示 `⛔ 番號 SDMM 在黑名單 → 此片應不會推播`，並標示「為何仍出現在資料庫」（多半是黑名單啟用前就抓到的）。
- 此資訊純前端計算，不需新 API；前端有 `makerMap`、`blockedIssuers`、`movie.matchBreakdown`。

### 3.5 Backfill 按鈕（AvCollect 觸發 AvBatch GHA）

**AvBatch 端 — 新檔 `.github/workflows/backfill.yml`**
```yaml
name: backfill-tags
on:
  workflow_dispatch:
    inputs:
      limit:
        description: 'Max movies to backfill (default 1000)'
        required: false
        default: '1000'
jobs:
  backfill:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run backfill-tags -- --limit ${{ inputs.limit }}
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
```
- 需要 `backfill-tags.ts` 支援 `--limit` 參數（檢查現況，若無則加）。

**AvCollect 端 — 新 API `src/app/api/admin/backfill/route.ts`**
- POST → 呼叫 GitHub REST `POST /repos/{owner}/{repo}/actions/workflows/backfill.yml/dispatches`，body `{ ref: 'main' }`。
- 需 env `GITHUB_TOKEN`（PAT with `actions:write`）+ `GITHUB_REPO`（如 `yuhan/AvBatch`）。
- 回 `{ success, dispatchedAt, runsUrl: 'https://github.com/{owner}/{repo}/actions/workflows/backfill.yml' }`。

**UI** — Settings 頁底加區塊：
```
🔄 維護工具

舊片標籤回補：515 部 tags=null
[ 觸發背景補抓 ]  最近一次：2026-05-25 03:12（5 分前）

⚠ 跑完才會有「收藏建議標籤」與正確的舊片評分
```
- 按鈕送 POST 後變 disabled 60s，顯示「已觸發 → [前往 GHA 查看進度]」連結。
- 「最近一次」由前端從 GitHub API `GET /actions/workflows/backfill.yml/runs?per_page=1` 取（伺服器側代理，避免 token 外流）。

---

## 4. 變更檔案清單

### AvCollect
- ✏️ `src/app/api/config/route.ts` — 擴充 schema + POST 處理 blockedIssuers / makerMap merge。
- ✏️ `src/lib/db/queries.ts` — `getTagSettings()` 回傳擴充；新增 `setConfigObject(key, obj)`。
- ✏️ `src/lib/taste/core.ts` — `MatchResult.breakdown`；`classify()` 填充。
- ✏️ `src/components/SettingsView.tsx` — 嵌入 `MakerPrefixManager` 與「維護工具」區塊。
- ➕ `src/components/MakerPrefixManager.tsx`
- ➕ `src/components/ScoreBreakdown.tsx`（給 Modal 用）
- ✏️ `src/components/MovieDetailModal.tsx` — 接 `<ScoreBreakdown>`。
- ➕ `src/app/api/admin/backfill/route.ts` — POST 觸發 GHA / GET 查最近 run。
- ✏️ `src/lib/db/config-seed.ts` — 確保 `blocked_issuers`、`maker_map` 兩 key 存在（已存在，不動）。

### AvBatch
- ✏️ `src/scheduler.ts:103` — 女優豁免。
- ✏️ `src/services/taste-core.ts` — `npm run sync-taste` 後同步（自動）。
- ➕ `.github/workflows/backfill.yml` — workflow_dispatch。
- ✏️ `scripts/backfill-tags.ts` — 確認支援 `--limit` 參數（若無則補）。

---

## 5. 互動流程

### Flow A：使用者關掉 SDMM
1. 進 `/settings` → 滾到「廠商與番號」→ 找到 SOD 卡片
2. 點 `[SDMM ✓]` → 即時變 `[SDMM ✗ line-through]`
3. 背景 POST `/api/config { blockedIssuers: ['SDMM', ...] }`
4. AvBatch 下次跑 scheduler → SDMM 新片直接 skip（line 103）
5. 既有 SDMM 舊片仍顯示在 AvCollect 首頁（依使用者選擇）

### Flow B：被擋的 SDMM 命中追蹤女優
1. AvBatch 抓到一部 SDMM-1234 標題含「河北彩伽」
2. line 103 命中 blockedIssuers → 檢查 preferredActresses → 命中 → 不 skip
3. 後續 classify 算出 high tier → category=ActressMatched → 推播

### Flow C：使用者點 Modal「為什麼?」
1. AvCard → 點開 Modal → 看到既有評分徽章與命中原因
2. 點「🔍 完整評分明細 ▼」展開
3. 顯示 actress / issuer / themes 各加分項 + 是否被閘門擋
4. 純前端計算，無 API 呼叫

### Flow D：使用者觸發 Backfill
1. `/settings` → 維護工具區塊 → 點「觸發背景補抓」
2. AvCollect POST `/api/admin/backfill` → 用 GITHUB_TOKEN 打 GitHub dispatches API
3. 回 `{ runsUrl }` → UI 顯示「已觸發」+ GHA 連結
4. 使用者點連結到 GHA 看進度；完成後 Discord 通知（既有 webhook）

---

## 6. 風險與取捨

| 風險 | 緩解 |
|---|---|
| 女優豁免誤判（標題含的字串並非真女優） | 可接受 — 與 `blocked_tags` 既有邏輯同水準；可後續以「真實女優欄」精確化 |
| `blocked_issuers` 變很長（幾十個 prefix）影響可讀性 | UI 廠商分組已解決；後端用 Set lookup，O(1) |
| Backfill 過程中 AvCollect 看不到進度 | 接受 — GHA UI 是真實源；UI 給連結 |
| GITHUB_TOKEN 設定在 Vercel | 用 fine-grained PAT，只給 `actions:write` to 單 repo |
| 評分明細暴露 baseline 邏輯（使用者可能困惑） | 文案明確：「+25（在追蹤清單）」「+60（已收藏 N 部該女優）」 |

---

## 7. 驗收條件

- [ ] `/settings` 廠商分組顯示所有現有 prefix；勾選狀態即時反映 `blocked_issuers`。
- [ ] 切換 chip → 1 秒內持久化，重新整理仍正確。
- [ ] 新增未知 prefix → 寫入 `maker_map` 並出現在指定廠商卡片。
- [ ] AvBatch scheduler：blocked prefix 命中追蹤女優 → 仍寫入 DB 與推播，分類 `ActressMatched`。
- [ ] AvBatch scheduler：blocked prefix 沒命中追蹤女優 → console log 跳過，不寫 DB。
- [ ] Modal「為什麼?」展開顯示三項加分 + 閘門狀態。
- [ ] 點 Backfill 按鈕 → GHA 出現新的 run；UI 顯示「已觸發」與連結。
- [ ] `taste-core` AvCollect 改完跑 `npm run sync-taste` 後 `npm run check-taste` 過。
- [ ] `npm run typecheck`、`npm run lint`、`npm run build` 三 repo 各自過。

---

## 8. 後續可做（不在本次範圍）

- 廠商級「軟降權」開關（不擋但分數打折）
- 設定變更日誌
- 每週推播摘要（命中 / 收藏率報表）
- AvCollect 內嵌 Backfill 進度條（SSE）
