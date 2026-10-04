# Metadata Enrichment Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 AvCollect → GitHub Actions → AvBatch metadata 回補流程 Review 發現的所有正確性、資料安全、可靠性與可觀測性問題。

**Architecture:** AvCollect 僅負責判斷持久化資料是否仍缺漏，使用短 timeout、有界重試與 correlation ID 派送工作；AvBatch 驗證抓取頁面番號，以 per-code concurrency 與條件式更新避免資料競態，且只有實際補齊需求才成功。兩端以測試鎖定相同的缺漏與輸入契約。

**Tech Stack:** Next.js 15、TypeScript、Node test runner、GitHub Actions、Drizzle ORM、Turso、Cheerio。

**Spec:** `docs/superpowers/plans/2026-10-04-vercel-metadata-enrichment.md` 與 2026-10-04 三方 Code Review findings。

## Global Constraints

- 除刪除外直接執行；不覆寫使用者原有 dirty files。
- 所有行為修復必須先有會因舊行為失敗的測試，再寫 production code。
- 手動新增 API 不得因 GitHub dispatch 失敗而失敗。
- Metadata 更新只能補缺漏或 placeholder，不得覆寫完整資料。
- AvBatch 必須先部署並驗證 workflow，之後才能部署 AvCollect。

---

### Task 1: AvCollect 缺漏判斷與派送可靠性

**Files:**
- Modify: `src/lib/metadata-enrichment.ts`
- Modify: `src/lib/metadata-enrichment.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `needsMetadataEnrichment(movie, metadataUnavailable)` 同時檢查 title、imageUrl、actress、tags。
- Produces: `dispatchMetadataEnrichment(code, options)` 驗證 code，使用 timeout、有界重試與 request ID。

- [ ] **Step 1: Write failing tests for fallback image/tags, invalid code, timeout, retry, network rejection, request ID and safe diagnostics**
- [ ] **Step 2: Run focused tests and confirm expected failures**
- [ ] **Step 3: Implement minimal candidate checks, validation, timeout/retry and structured result**
- [ ] **Step 4: Run focused tests and confirm pass**

### Task 2: AvCollect route 來源一致性

**Files:**
- Modify: `src/app/api/movies/route.ts`
- Create or Modify: route/helper tests under `src/lib` or `src/app/api/movies`

**Interfaces:**
- Consumes: persisted movie and submitted source metadata state.
- Produces: metadataUnavailable only affects matching persisted source/url; API remains successful when dispatch fails.

- [ ] **Step 1: Write failing tests for submitted/persisted source mismatch and dispatch failure**
- [ ] **Step 2: Run tests and confirm expected failures**
- [ ] **Step 3: Implement a small pure decision helper and wire it into the route**
- [ ] **Step 4: Run tests and confirm pass**

### Task 3: AvBatch page identity and source extraction

**Files:**
- Modify: `src/scrapers/detail-tags.ts`
- Modify: `src/scrapers/detail-tags.test.ts`

**Interfaces:**
- Produces: `fetchMovieMetadata(source, url, expectedCode)` only returns metadata when title/canonical URL identifies the requested code.

- [ ] **Step 1: Write failing tests for wrong movie, homepage/challenge pages and success fixtures for Jable/MissAV/Javrate**
- [ ] **Step 2: Run focused tests and confirm expected failures**
- [ ] **Step 3: Implement shared canonical code comparison and identity validation**
- [ ] **Step 4: Run focused tests and confirm pass**

### Task 4: AvBatch safe targeted repair

**Files:**
- Modify: `src/services/metadata-repair.ts`
- Modify: `src/services/metadata-repair.test.ts`
- Modify: `scripts/backfill-tags.ts`
- Add focused CLI/service tests if needed.

**Interfaces:**
- Produces: canonical target resolution, explicit missing-field reporting, conditional update/re-read behavior and non-zero failure when requested gaps remain.

- [ ] **Step 1: Write failing tests for code variants, whitespace code, false-success and concurrent field changes**
- [ ] **Step 2: Run focused tests and confirm expected failures**
- [ ] **Step 3: Implement exact-first canonical lookup, missing-field evaluation and compare-and-set update**
- [ ] **Step 4: Run focused tests and confirm pass**

### Task 5: Workflow concurrency and contract observability

**Files:**
- Modify: `.github/workflows/backfill.yml`
- Modify: `.env.example` and relevant documentation.

**Interfaces:**
- Consumes: `code`, `limit`, `request_id` workflow inputs.
- Produces: safe blank-code fallback, per-code concurrency, identifiable run name and failure summary.

- [ ] **Step 1: Add an executable workflow contract test or YAML parse assertion**
- [ ] **Step 2: Confirm it fails against the current workflow**
- [ ] **Step 3: Pass both CLI flags, add concurrency/request ID/run name and document token/rollout requirements**
- [ ] **Step 4: Parse YAML and run contract tests**

### Task 6: Cross-repo verification

- [ ] **Step 1: Run AvCollect focused tests, full tests, lint and build**
- [ ] **Step 2: Run AvBatch focused tests, full tests, typecheck, build, taste and workflow YAML parse**
- [ ] **Step 3: Run `git diff --check` in both repos and inspect only scoped diffs**
- [ ] **Step 4: Request fresh cross-repo review and resolve all Critical/Important findings**
