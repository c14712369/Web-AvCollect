# Vercel 手動新增 Metadata 回補 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 當 AvCollect 在 Vercel 無法從受 Cloudflare 保護的詳情頁取得完整資料時，自動派送指定番號到 AvBatch，透過 GitHub Actions 的 WARP + FlareSolverr 修復同一筆 Turso 資料。

**Architecture:** AvCollect 負責判斷回傳影片是否缺標題或女優，並透過 GitHub workflow dispatch 傳送 `code`。AvBatch 沿用既有 `backfill.yml` 執行環境，新增單筆模式；單筆模式抓完整 metadata，僅以有效欄位修補既有資料，不覆蓋可用值。

**Tech Stack:** Next.js 15 Route Handler、TypeScript、GitHub Actions workflow dispatch、AvBatch/tsx、Cheerio、Drizzle ORM、Turso、Node test runner。

**Spec:** `docs/ARCHITECTURE.md` 與 2026-10-04 使用者確認的「Vercel 快速保存、AvBatch 非同步回補」方案。

## Global Constraints

- 保留現有手動新增成功行為；GitHub dispatch 失敗不得讓新增 API 整體失敗。
- GitHub token 只留在伺服器端，workflow 只接收已正規化的番號，不接收任意 URL。
- AvBatch 僅更新抓到的有效 metadata，不以空值或挑戰頁內容覆蓋資料庫。
- 不碰兩個 repository 內既有、與本功能無關的未提交變更。

---

### Task 1: AvCollect metadata 派送邊界

**Files:**
- Create: `src/lib/metadata-enrichment.ts`
- Create: `src/lib/metadata-enrichment.test.ts`
- Modify: `src/app/api/movies/route.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `needsMetadataEnrichment(movie, metadataUnavailable): boolean`
- Produces: `dispatchMetadataEnrichment(code, options?): Promise<MetadataDispatchResult>`
- GitHub payload: `{ ref: "main", inputs: { code: "FNS-098", limit: "1" } }`

- [x] **Step 1: Write failing tests for incomplete-metadata detection and dispatch payload**

```ts
test('queues a normalized code for an incomplete movie', async () => {
  const result = await dispatchMetadataEnrichment('fns-098', {
    repo: 'owner/AvBatch',
    token: 'token',
    fetchImpl,
  });
  assert.equal(result.queued, true);
  assert.deepEqual(JSON.parse(request.body), {
    ref: 'main',
    inputs: { code: 'FNS-098', limit: '1' },
  });
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/lib/metadata-enrichment.test.ts`
Expected: FAIL because `metadata-enrichment.ts` does not exist.

- [x] **Step 3: Implement minimal detection and GitHub dispatch helper**

```ts
export function needsMetadataEnrichment(movie: Pick<Movie, 'code' | 'title' | 'actress'>, unavailable: boolean) {
  return unavailable || movie.title.trim() === movie.code || !movie.actress?.trim();
}
```

Dispatch errors return `{ queued: false, reason }` and log a warning; they do not throw into the movie route.

- [x] **Step 4: Wire the helper after the Turso upsert**

The route awaits a targeted dispatch only when `needsMetadataEnrichment(...)` is true and returns the dispatch result as `enrichment` in the JSON response.

- [x] **Step 5: Run focused tests and verify GREEN**

Run: `npx tsx --test src/lib/metadata-enrichment.test.ts`
Expected: all tests pass.

### Task 2: AvBatch complete metadata extraction

**Files:**
- Modify: `src/scrapers/detail-tags.ts`
- Modify: `src/scrapers/detail-tags.test.ts`

**Interfaces:**
- Produces: `fetchMovieMetadata(source, url): Promise<MovieMetadataResult>`
- `MovieMetadataResult`: `{ title: string | null; imageUrl: string | null; tags: string[]; actress: string | null }`
- Existing `fetchMovieDetails` and `fetchMovieTags` remain backward compatible.

- [x] **Step 1: Add a failing parser test using a Jable placeholder-actress fixture**

```ts
assert.deepEqual(extractJableMetadata(html), {
  title: 'FNS-098 測試標題 濱邊彌生',
  imageUrl: 'https://cdn.example/fns-098.jpg',
  tags: ['巨乳'],
  actress: '浜辺やよい',
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/scrapers/detail-tags.test.ts`
Expected: FAIL because the metadata extractor is missing.

- [x] **Step 3: Implement source-aware title/image extraction and retain existing tag/actress behavior**

Reject empty titles and known Cloudflare/error-page titles. Strip supported site suffixes before returning the title.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npx tsx --test src/scrapers/detail-tags.test.ts`
Expected: all detail metadata tests pass.

### Task 3: AvBatch targeted backfill workflow

**Files:**
- Modify: `scripts/backfill-tags.ts`
- Create: `src/services/metadata-repair.ts`
- Create: `src/services/metadata-repair.test.ts`
- Modify: `.github/workflows/backfill.yml`

**Interfaces:**
- Produces: `buildMetadataRepairPatch(current, fetched): Partial<MovieRow> | null`
- CLI accepts `--code FNS-098`; without `--code`, existing bulk tags backfill remains unchanged.

- [x] **Step 1: Write failing repair-patch tests**

```ts
assert.deepEqual(buildMetadataRepairPatch(
  { code: 'FNS-098', title: 'FNS-098', imageUrl: 'fallback', actress: null, tags: null },
  { title: '完整標題', imageUrl: null, actress: '浜辺やよい', tags: ['巨乳'] },
), { title: '完整標題', actress: '浜辺やよい', tags: '["巨乳"]' });
```

- [x] **Step 2: Run focused test and verify RED**

Run: `npx tsx --test src/services/metadata-repair.test.ts`
Expected: FAIL because `metadata-repair.ts` does not exist.

- [x] **Step 3: Implement non-destructive repair patch and targeted CLI branch**

The targeted branch loads exactly one row by code, calls `fetchMovieMetadata`, writes only valid improvements, and exits non-zero when the code does not exist or no usable metadata can be fetched.

- [x] **Step 4: Add optional workflow input and conditional CLI arguments**

```yaml
code:
  description: '只回補指定番號；空白則跑既有批次模式'
  required: false
  default: ''
```

- [x] **Step 5: Run AvBatch tests and typecheck**

Run: `npm test`
Expected: all tests pass.

Run: `npm run typecheck`
Expected: exit 0.

### Task 4: Cross-project verification

**Files:**
- Verify all files above.

- [x] **Step 1: Run AvCollect verification**

Run: `npm test`, `npm run lint`, `npm run build`
Expected: all exit 0.

- [ ] **Step 2: Run AvBatch verification**

Run: `npm test`, `npm run typecheck`, `npm run check-schema`, `npm run check-taste`
Expected: all exit 0.

Verification note: `npm test`、`npm run typecheck`、`npm run build`、`npm run check-taste` 已通過；`npm run check-schema` 發現本次修改前即存在的 schema 漂移（AvBatch 尚缺 AvCollect 的 `favorites_snapshots` 與 `viewed_movies`），未在本功能中混入無關同步修改。

- [x] **Step 3: Inspect both repository diffs**

Confirm only the planned files plus pre-existing user changes appear; verify no secrets or tokens entered tracked files.
