# 番號 Prefix 管理 + 三項延伸 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AvCollect `/settings` 新增「廠商與番號」分組勾選 UI（寫入既有硬閘門 `blocked_issuers`），同時加女優豁免、評分明細彈窗、一鍵 Backfill 三項延伸。

**Architecture:** 不動 DB schema。前端反轉既有 `maker_map` 為 `maker → prefixes[]` 顯示；toggle chip 寫入 `blocked_issuers`。AvBatch scheduler `line 103` 改成「命中追蹤女優則豁免」。Modal 加可展開段顯示 `breakdown`（擴充 `taste/core.classify()` 回傳值）。Backfill 用 GHA `workflow_dispatch` + GitHub REST API。

**Tech Stack:** Next.js 15 / React 19 / Tailwind v4 / Drizzle / Turso / Framer Motion / Cheerio / Node-cron / GitHub Actions

**Repos:**
- `AvCollect` = `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect`（Vercel 部署的前端 + Turso 讀寫 API）
- `AvBatch` = `C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch`（GHA 排程的爬蟲與推播）

**Spec:** `docs/superpowers/specs/2026-05-26-prefix-management-design.md`

**Conventions:**
- 全部以 PowerShell 為主，Windows 路徑用反斜線。
- 沒有單元測試框架；驗證 = `npm run lint` + `next build`（含 typecheck）+ 手動 smoke。
- 每完成一個 Phase（一塊邏輯單元）commit 一次，中文 commit message。
- 兩 repo 各自 commit，AvBatch 那邊另起。

---

## Phase 1 — taste/core.ts 加 breakdown

### Task 1: 擴充 MatchResult / classify 回傳 breakdown

**Files:**
- Modify: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\lib\taste\core.ts`

- [ ] **Step 1：擴充型別與 `classify`**

在 `core.ts` 既有 `MatchResult` 之前加：

```ts
export interface MatchBreakdown {
  actress: { hit: string | null; score: number; weight: number };
  issuer: { hit: string | null; score: number; weight: number };
  themes: { hits: string[]; score: number };
}
```

把 `MatchResult` 改為：

```ts
export interface MatchResult {
  /** 0–100 契合度分數。 */
  score: number;
  tier: MatchTier;
  /** 人類可讀的命中原因（給 App / 推播顯示）。 */
  reasons: string[];
  /** 完整評分明細（給 App 「為什麼?」彈窗用）。 */
  breakdown: MatchBreakdown;
}
```

`classify()` 函式改寫為（保留既有邏輯 + 累積 breakdown）：

```ts
export function classify(features: MovieFeatures, profile: TasteProfile): MatchResult {
  const reasons: string[] = [];
  const breakdown: MatchBreakdown = {
    actress: { hit: null, score: 0, weight: 0 },
    issuer: { hit: null, score: 0, weight: 0 },
    themes: { hits: [], score: 0 },
  };
  let score = 0;

  if (features.actress) {
    const w = profile.actress[features.actress] ?? 0;
    if (w > 0) {
      const s = saturate(w) * TASTE_WEIGHTS.actressMax;
      score += s;
      reasons.push(`女優 ${features.actress}`);
      breakdown.actress = { hit: features.actress, score: Math.round(s), weight: w };
    }
  }

  const iw = profile.issuer[features.issuer] ?? 0;
  if (iw > 0) {
    const s = saturate(iw) * TASTE_WEIGHTS.issuerMax;
    score += s;
    reasons.push(`廠商 ${features.issuer}`);
    breakdown.issuer = { hit: features.issuer, score: Math.round(s), weight: iw };
  }

  let themeRaw = 0;
  const hitTags: string[] = [];
  for (const t of features.themes) {
    const tw = profile.theme[t] ?? 0;
    if (tw > 0) {
      themeRaw += saturate(tw);
      hitTags.push(t);
    }
  }
  if (themeRaw > 0) {
    const s = Math.min(1, themeRaw) * TASTE_WEIGHTS.themeMax;
    score += s;
    reasons.push(`標籤 ${hitTags.join('、')}`);
    breakdown.themes = { hits: hitTags, score: Math.round(s) };
  }

  score = Math.round(Math.max(0, Math.min(100, score)));

  let tier: MatchTier;
  if (score >= TASTE_THRESHOLDS.high) tier = 'high';
  else if (score >= TASTE_THRESHOLDS.medium) tier = 'medium';
  else tier = 'low';

  return { score, tier, reasons, breakdown };
}
```

- [ ] **Step 2：本地驗證 typecheck**

Run（在 AvCollect repo）：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
```

Expected：無錯誤輸出。

### Task 2: 同步 taste-core 到 AvBatch

**Files:**
- Auto-sync: `C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch\src\services\taste-core.ts`

- [ ] **Step 1：跑 sync 腳本**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
npm run sync-taste
```

Expected：輸出 `[taste-sync] copied AvCollect/src/lib/taste/core.ts -> src/services/taste-core.ts`。

- [ ] **Step 2：跑 check-taste 確認無漂移**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
npm run check-taste
```

Expected：`[taste-check] in sync` 或類似訊息（exit code 0）。

---

## Phase 2 — 後端 API 與 queries 擴充（AvCollect）

### Task 3: queries.ts 加 setConfigObject + getTagSettings 擴充

**Files:**
- Modify: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\lib\db\queries.ts`

- [ ] **Step 1：新增 setConfigObject helper**

在 `setConfigArray` 函式下方加：

```ts
/** 寫入（或覆蓋）某個 app_config 物件鍵。 */
export const setConfigObject = async (key: string, value: Record<string, string>): Promise<void> => {
  const json = JSON.stringify(value);
  await db
    .insert(appConfig)
    .values({ key, value: json })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { value: json, updatedAt: new Date() },
    });
};
```

- [ ] **Step 2：擴充 TagSettings 介面**

把既有 `TagSettings` 介面改為：

```ts
export interface TagSettings {
  trackedTags: string[];
  blockedTags: string[];
  blockedIssuers: string[];
  makerMap: Record<string, string>;
  /** 收藏裡常出現、但尚未追蹤/封鎖的標籤（依出現次數排序），供一鍵加入。 */
  suggestions: string[];
}
```

- [ ] **Step 3：擴充 getTagSettings 回傳**

修改 `getTagSettings` 函式末尾 `return` 為：

```ts
  return {
    trackedTags: cfg.trackedTags,
    blockedTags: cfg.blockedTags,
    blockedIssuers: cfg.blockedIssuers,
    makerMap: cfg.makerMap,
    suggestions,
  };
```

- [ ] **Step 4：驗證 typecheck**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
```

Expected：無錯誤（SettingsView 仍只用舊欄位，新增欄位不會破壞）。

### Task 4: /api/config 接受 blockedIssuers / makerMap

**Files:**
- Modify: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\app\api\config\route.ts`

- [ ] **Step 1：擴充 zod schema 與 POST**

完整檔案改為：

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTagSettings, setConfigArray, setConfigObject } from '@/lib/db/queries';
import { getConfig, invalidateConfigCache } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...(await getTagSettings()) });
  } catch (error) {
    console.error('[GET /api/config]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

const tagArray = z.array(z.string().trim().min(1).max(30)).max(300);
const prefixArray = z.array(
  z.string().trim().min(1).max(20).regex(/^[A-Z0-9]+$/i)
).max(500);
const makerMapPatch = z.record(
  z.string().trim().min(1).max(20).regex(/^[A-Z0-9]+$/i),
  z.string().trim().min(1).max(40)
);

const schema = z.object({
  trackedTags: tagArray.optional(),
  blockedTags: tagArray.optional(),
  blockedIssuers: prefixArray.optional(),
  makerMap: makerMapPatch.optional(),
});

/** 去除空白並去重（保序）。 */
const normalize = (arr: string[]): string[] =>
  Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

/** 將 prefix 統一轉大寫並去重。 */
const normalizePrefixes = (arr: string[]): string[] =>
  Array.from(new Set(arr.map((s) => s.trim().toUpperCase()).filter(Boolean)));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { trackedTags, blockedTags, blockedIssuers, makerMap } = parsed.data;
    if (trackedTags) await setConfigArray('tracked_tags', normalize(trackedTags));
    if (blockedTags) await setConfigArray('blocked_tags', normalize(blockedTags));
    if (blockedIssuers) await setConfigArray('blocked_issuers', normalizePrefixes(blockedIssuers));
    if (makerMap) {
      // merge：不覆蓋既有對應，僅補上 / 改寫送來的 key
      const current = (await getConfig()).makerMap;
      const upperKeyed: Record<string, string> = {};
      for (const [k, v] of Object.entries(makerMap)) upperKeyed[k.toUpperCase()] = v;
      await setConfigObject('maker_map', { ...current, ...upperKeyed });
    }

    invalidateConfigCache();
    return NextResponse.json({ success: true, ...(await getTagSettings()) });
  } catch (error) {
    console.error('[POST /api/config]', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 2：驗證 typecheck + lint**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
npm run lint
```

Expected：兩個都通過。

- [ ] **Step 3：Phase 1+2 Commit (AvCollect)**

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
git add src/lib/taste/core.ts src/lib/db/queries.ts src/app/api/config/route.ts
git commit -m "feat: classify 回傳 breakdown + /api/config 接受 blockedIssuers/makerMap"
```

- [ ] **Step 4：Phase 1 Commit (AvBatch)**

```powershell
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
git add src/services/taste-core.ts
git commit -m "chore: 同步 taste-core (新增 breakdown 欄位)"
```

---

## Phase 3 — Prefix 管理 UI（AvCollect）

### Task 5: 新增 MakerPrefixManager 元件

**Files:**
- Create: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\components\MakerPrefixManager.tsx`

- [ ] **Step 1：寫元件骨架**

完整檔案：

```tsx
'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Factory, Plus, RotateCcw, CheckCheck } from 'lucide-react';

interface Props {
  makerMap: Record<string, string>;
  blockedIssuers: string[];
  onChange: (patch: { blockedIssuers?: string[]; makerMap?: Record<string, string> }) => void;
}

interface NewPrefixForm {
  prefix: string;
  maker: string;
}

/** 把 maker_map 反轉為 { maker → prefixes[] }，並按字母排序。 */
function groupByMaker(map: Record<string, string>): Array<[string, string[]]> {
  const out: Record<string, string[]> = {};
  for (const [prefix, maker] of Object.entries(map)) {
    const key = maker || '(未分類)';
    (out[key] ??= []).push(prefix.toUpperCase());
  }
  for (const list of Object.values(out)) list.sort();
  return Object.entries(out).sort(([a], [b]) => {
    if (a === '(未分類)') return 1;
    if (b === '(未分類)') return -1;
    return a.localeCompare(b);
  });
}

export function MakerPrefixManager({ makerMap, blockedIssuers, onChange }: Props) {
  const blocked = useMemo(() => new Set(blockedIssuers.map((p) => p.toUpperCase())), [blockedIssuers]);
  const groups = useMemo(() => groupByMaker(makerMap), [makerMap]);
  const knownMakers = useMemo(
    () => Array.from(new Set(Object.values(makerMap))).sort(),
    [makerMap]
  );
  const [form, setForm] = useState<NewPrefixForm>({ prefix: '', maker: '' });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (prefix: string) => {
    const next = new Set(blocked);
    if (next.has(prefix)) next.delete(prefix);
    else next.add(prefix);
    onChange({ blockedIssuers: Array.from(next).sort() });
  };

  const setAll = (prefixes: string[], block: boolean) => {
    const next = new Set(blocked);
    for (const p of prefixes) {
      if (block) next.add(p);
      else next.delete(p);
    }
    onChange({ blockedIssuers: Array.from(next).sort() });
  };

  const addPrefix = () => {
    const prefix = form.prefix.trim().toUpperCase();
    const maker = form.maker.trim();
    if (!prefix || !maker) return;
    if (!/^[A-Z0-9]+$/.test(prefix)) return;
    onChange({ makerMap: { [prefix]: maker } });
    setForm({ prefix: '', maker: '' });
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="mb-1 flex items-center gap-2">
        <Factory className="h-4 w-4 text-sky-300" />
        <h2 className="text-base font-semibold">廠商與番號</h2>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-sm font-mono text-white/50">
          {Object.keys(makerMap).length}
        </span>
      </div>
      <p className="mb-4 text-sm text-white/40">
        勾選的 prefix 會被追蹤；取消勾選 = 加入硬閘門黑名單，新片不爬不推
      </p>

      <div className="space-y-3">
        {groups.map(([maker, prefixes]) => {
          const allBlocked = prefixes.every((p) => blocked.has(p));
          const noneBlocked = prefixes.every((p) => !blocked.has(p));
          const isExpanded = expanded[maker] ?? prefixes.length <= 8;
          const visiblePrefixes = isExpanded ? prefixes : prefixes.slice(0, 8);
          return (
            <div key={maker} className="rounded-xl border border-white/5 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white/85">{maker}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAll(prefixes, false)}
                    disabled={noneBlocked}
                    className="flex items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200/80 transition-all hover:bg-emerald-500/20 disabled:opacity-30"
                  >
                    <CheckCheck className="h-3 w-3" /> 全選
                  </button>
                  <button
                    onClick={() => setAll(prefixes, true)}
                    disabled={allBlocked}
                    className="flex items-center gap-1 rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200/80 transition-all hover:bg-rose-500/20 disabled:opacity-30"
                  >
                    <RotateCcw className="h-3 w-3" /> 全清
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <AnimatePresence initial={false}>
                  {visiblePrefixes.map((p) => {
                    const isBlocked = blocked.has(p);
                    return (
                      <motion.button
                        key={p}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        onClick={() => toggle(p)}
                        className={
                          isBlocked
                            ? 'rounded-full border border-white/5 bg-zinc-800/50 px-3 py-1 text-sm text-zinc-500 line-through transition-all hover:bg-zinc-800/80'
                            : 'rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-1 text-sm text-violet-100 transition-all hover:bg-violet-500/30'
                        }
                      >
                        {p}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
                {!isExpanded && (
                  <button
                    onClick={() => setExpanded({ ...expanded, [maker]: true })}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/60 hover:bg-white/10"
                  >
                    +{prefixes.length - 8} 更多
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-black/20 p-3">
        <input
          value={form.prefix}
          onChange={(e) => setForm({ ...form, prefix: e.target.value })}
          placeholder="新 prefix (例 ABCD)"
          className="flex-1 min-w-[120px] rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm uppercase text-white placeholder:text-white/25 outline-none focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/30"
        />
        <input
          list="known-makers"
          value={form.maker}
          onChange={(e) => setForm({ ...form, maker: e.target.value })}
          placeholder="廠商名"
          className="flex-1 min-w-[120px] rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/30"
        />
        <datalist id="known-makers">
          {knownMakers.map((m) => <option key={m} value={m} />)}
        </datalist>
        <button
          onClick={addPrefix}
          disabled={!form.prefix.trim() || !form.maker.trim()}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-indigo-500/40 active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          <Plus className="h-3.5 w-3.5" /> 加入
        </button>
      </div>
    </section>
  );
}

export default MakerPrefixManager;
```

- [ ] **Step 2：驗證 typecheck**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
```

Expected：無錯誤。

### Task 6: SettingsView 嵌入 MakerPrefixManager + 即時持久化

**Files:**
- Modify: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\components\SettingsView.tsx`

- [ ] **Step 1：注入 makerMap / blockedIssuers state 與 即時保存**

把 `SettingsView` 函式內部的 state 區塊與 `save` 函式擴充。先在 `useState` 區塊下方加：

```ts
  const [makerMap, setMakerMap] = useState<Record<string, string>>(initial.makerMap);
  const [blockedIssuers, setBlockedIssuers] = useState<string[]>(initial.blockedIssuers);
```

把既有 `dirty` 改為：

```ts
  const dirty = useMemo(
    () =>
      JSON.stringify(tracked) !== JSON.stringify(initial.trackedTags) ||
      JSON.stringify(blocked) !== JSON.stringify(initial.blockedTags),
    [tracked, blocked, initial]
  );
```
（不動 — prefix manager 即時持久化，不走「儲存變更」按鈕）

在 `save` 函式下方加新 helper：

```ts
  const persistPrefix = async (patch: { blockedIssuers?: string[]; makerMap?: Record<string, string> }) => {
    // 樂觀更新
    if (patch.blockedIssuers) setBlockedIssuers(patch.blockedIssuers);
    if (patch.makerMap) setMakerMap((prev) => ({ ...prev, ...patch.makerMap }));
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.success) throw new Error(typeof data.error === 'string' ? data.error : '儲存失敗');
      setBlockedIssuers(data.blockedIssuers);
      setMakerMap(data.makerMap);
    } catch (e) {
      // 回滾
      setBlockedIssuers(initial.blockedIssuers);
      setMakerMap(initial.makerMap);
      setError((e as Error).message);
    }
  };
```

- [ ] **Step 2：在 JSX 渲染 MakerPrefixManager**

檔案頂端 import：

```ts
import { MakerPrefixManager } from './MakerPrefixManager';
```

在既有「黑名單標籤」`<TagEditor />` 之後加：

```tsx
        <MakerPrefixManager
          makerMap={makerMap}
          blockedIssuers={blockedIssuers}
          onChange={persistPrefix}
        />
```

- [ ] **Step 3：驗證 typecheck + lint**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
npm run lint
```

Expected：兩個都通過。

- [ ] **Step 4：手動 smoke**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npm run dev
```

打開瀏覽器 `http://localhost:3000/settings`：

預期：
- 看到「廠商與番號」卡片，廠商按字母排序
- SOD 卡片裡有 STARS / START / SDMM... chip
- 點 SDMM → 立刻變灰色刪除線
- 重新整理 → SDMM 仍維持灰色刪除線（已持久化）
- 點「全清」→ 整廠商 chip 都變灰
- 試新增 prefix「TEST」+「TestMaker」→ 出現新卡片

- [ ] **Step 5：Phase 3 Commit**

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
git add src/components/MakerPrefixManager.tsx src/components/SettingsView.tsx
git commit -m "feat: 設定頁加廠商分組番號管理 UI (寫入 blocked_issuers)"
```

---

## Phase 4 — AvBatch scheduler 女優豁免

### Task 7: scheduler 女優豁免

**Files:**
- Modify: `C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch\src\scheduler.ts`

- [ ] **Step 1：改 blockedIssuers 判斷邏輯**

找到既有：

```ts
      // 黑名單最終把關（最優先，命中即跳過、不浪費評分）
      if (filters.blockedIssuers.includes(issuer)) continue;
```

改為：

```ts
      // 黑名單最終把關（命中追蹤女優視為「使用者明確想看」→ 豁免，與 blocked_tags 同邏輯）
      if (filters.blockedIssuers.includes(issuer)) {
        const exempt = filters.preferredActresses.some((name) => movie.title.includes(name));
        if (!exempt) {
          console.log(`[Filter] 番號黑名單跳過: ${movie.code} (${issuer})`);
          continue;
        }
        console.log(`[Filter] 番號黑名單但命中追蹤女優，豁免: ${movie.code}`);
      }
```

- [ ] **Step 2：驗證 typecheck**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
npm run build 2>&1 | Select-Object -First 50
```

（若 AvBatch 有 build script；否則用 `npx tsc --noEmit`）

Expected：無錯誤。

- [ ] **Step 3：Phase 4 Commit (AvBatch)**

```powershell
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
git add src/scheduler.ts
git commit -m "feat: 番號黑名單命中追蹤女優時豁免放行"
```

---

## Phase 5 — 評分明細彈窗 ScoreBreakdown（AvCollect）

### Task 8: 擴充 Movie 型別與 listMovies 注入 breakdown

**Files:**
- Modify: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\types\av.ts`
- Modify: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\lib\db\queries.ts`

- [ ] **Step 1：擴充 Movie 型別**

在 `src/types/av.ts` 最後加：

```ts
// 從 core 匯入既有 breakdown 型別
import type { MatchBreakdown } from '@/lib/taste/core';
```

把第 1 行 import 合併：

```ts
import type { MatchBreakdown, MatchTier } from '@/lib/taste/core';
```

把 `Movie` interface 加一欄：

```ts
  /** 評分明細（給 Modal 「為什麼?」用）。 */
  matchBreakdown?: MatchBreakdown;
```

- [ ] **Step 2：listMovies 注入 matchBreakdown**

修改 `src/lib/db/queries.ts` 末段 `visible.map(...)`：

```ts
  return visible.map((row) => {
    const match = classify(featuresOf(row), profile);
    return {
      ...enrich(row),
      matchScore: match.score,
      matchTier: match.tier,
      matchReasons: match.reasons,
      matchBreakdown: match.breakdown,
    };
  });
```

- [ ] **Step 3：驗證 typecheck**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
```

Expected：無錯誤。

### Task 9: 新元件 ScoreBreakdown

**Files:**
- Create: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\components\ScoreBreakdown.tsx`

- [ ] **Step 1：寫元件**

完整檔案：

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Target, Factory, Tag, Ban, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { Movie } from '@/types/av';
import { toIssuer } from '@/lib/taste/core';

interface ConfigSnapshot {
  blockedIssuers: string[];
  blockedTags: string[];
  trackedTags: string[];
  makerMap: Record<string, string>;
}

interface Props {
  movie: Movie;
}

export function ScoreBreakdown({ movie }: Props) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<ConfigSnapshot | null>(null);

  useEffect(() => {
    if (!open || cfg) return;
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setCfg({
            blockedIssuers: d.blockedIssuers ?? [],
            blockedTags: d.blockedTags ?? [],
            trackedTags: d.trackedTags ?? [],
            makerMap: d.makerMap ?? {},
          });
        }
      })
      .catch(() => {});
  }, [open, cfg]);

  if (!movie.matchBreakdown) return null;
  const b = movie.matchBreakdown;
  const issuer = toIssuer(movie.code);
  const isBlocked = cfg?.blockedIssuers.includes(issuer);
  const blockedTagHits = cfg
    ? movie.themes.filter((t) => cfg.blockedTags.includes(t))
    : [];

  return (
    <div className="mt-4 rounded-2xl border border-white/5 bg-black/20">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm text-white/70 transition-colors hover:text-white"
      >
        <span className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-300" /> 完整評分明細
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-white/5 px-4 py-3 text-sm">
              <Row icon={<Target className="h-3.5 w-3.5 text-pink-300" />} label="女優">
                {b.actress.hit ? (
                  <span>{b.actress.hit} <span className="text-white/40">(權重 {b.actress.weight.toFixed(1)})</span></span>
                ) : (
                  <span className="text-white/30">未命中</span>
                )}
                <Score value={b.actress.score} max={60} />
              </Row>
              <Row icon={<Factory className="h-3.5 w-3.5 text-sky-300" />} label="廠商">
                {b.issuer.hit ? (
                  <span>{b.issuer.hit} <span className="text-white/40">(權重 {b.issuer.weight.toFixed(1)})</span></span>
                ) : (
                  <span className="text-white/30">未命中</span>
                )}
                <Score value={b.issuer.score} max={25} />
              </Row>
              <Row icon={<Tag className="h-3.5 w-3.5 text-amber-300" />} label="標籤">
                {b.themes.hits.length > 0 ? (
                  <span>{b.themes.hits.join('、')}</span>
                ) : (
                  <span className="text-white/30">未命中</span>
                )}
                <Score value={b.themes.score} max={15} />
              </Row>

              <div className="mt-3 border-t border-white/5 pt-3 text-sm font-semibold">
                總分 {movie.matchScore ?? 0} → {tierLabel(movie.matchTier)}
              </div>

              {cfg && (
                <div className="mt-2 space-y-1 text-sm">
                  {isBlocked ? (
                    <div className="flex items-center gap-1.5 text-rose-300/90">
                      <Ban className="h-3.5 w-3.5" />
                      番號 {issuer} 在黑名單 — 新片應不會被推播
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-300/80">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      番號 {issuer} 不在黑名單
                    </div>
                  )}
                  {blockedTagHits.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-amber-300/90">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      命中封鎖標籤：{blockedTagHits.join('、')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-300/80">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      未命中任何封鎖標籤
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-white/60">{icon}{label}</div>
      <div className="flex flex-1 items-center justify-end gap-3 text-right text-white/85">
        {children}
      </div>
    </div>
  );
}

function Score({ value, max }: { value: number; max: number }) {
  return (
    <span className="ml-2 rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs text-white/70">
      +{value} / {max}
    </span>
  );
}

function tierLabel(tier?: string): string {
  if (tier === 'high') return '🎯 為你推薦';
  if (tier === 'medium') return '🤔 可能也喜歡';
  return '⬇️ 雜訊';
}

export default ScoreBreakdown;
```

- [ ] **Step 2：驗證 typecheck**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
```

Expected：無錯誤。

### Task 10: MovieDetailModal 接 ScoreBreakdown

**Files:**
- Modify: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\components\MovieDetailModal.tsx`

- [ ] **Step 1：import ScoreBreakdown**

在既有 import 區下方加：

```ts
import { ScoreBreakdown } from './ScoreBreakdown';
```

- [ ] **Step 2：在 Modal 內合適位置渲染**

找到 Modal 內的「命中原因」段落（在 `matchReasons` 顯示之後）。如果沒明確區塊，就在影片資訊 section 結尾、按鈕之前插入：

```tsx
<ScoreBreakdown movie={movie} />
```

- [ ] **Step 3：驗證 typecheck + lint**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
npm run lint
```

Expected：兩個都通過。

- [ ] **Step 4：手動 smoke**

Run（若 dev server 沒開）：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npm run dev
```

開首頁 → 點任一卡片 → Modal 內滾下去找「完整評分明細」展開：

預期：
- 顯示女優/廠商/標籤三項加分
- 顯示「總分 X → 🎯 為你推薦」
- 顯示番號是否在黑名單

- [ ] **Step 5：Phase 5 Commit**

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
git add src/types/av.ts src/lib/db/queries.ts src/components/ScoreBreakdown.tsx src/components/MovieDetailModal.tsx
git commit -m "feat: Modal 加完整評分明細彈窗 (顯示加分項與閘門狀態)"
```

---

## Phase 6 — Backfill GHA workflow + 觸發 API + UI

### Task 11: backfill-tags.ts 支援 --limit

**Files:**
- Modify: `C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch\scripts\backfill-tags.ts`

- [ ] **Step 1：加 --limit 參數解析**

在 `async function main()` 開頭加：

```ts
  const limitArg = process.argv.find((a) => a.startsWith('--limit'));
  const limit = limitArg ? Number(limitArg.split('=')[1] ?? process.argv[process.argv.indexOf(limitArg) + 1]) : Infinity;
```

把既有 `rows` 取出後加：

```ts
  const todo = Number.isFinite(limit) ? rows.slice(0, limit) : rows;
  console.log(`[Backfill] 開始：${todo.length} / ${rows.length} 部 (limit=${Number.isFinite(limit) ? limit : '∞'})`);
```

把 for 迴圈改成跑 `todo` 而非 `rows`：

```ts
  for (const r of todo) {
```

最後 progress log 也把 `rows.length` 改 `todo.length`：

```ts
    if (done % 25 === 0 || done === todo.length) {
      console.log(`[Backfill] ${done}/${todo.length}  ` +
```

- [ ] **Step 2：驗證 typecheck**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
npx tsc --noEmit
```

Expected：無錯誤。

### Task 12: GHA workflow_dispatch

**Files:**
- Create: `C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch\.github\workflows\backfill.yml`

- [ ] **Step 1：寫 workflow**

完整檔案：

```yaml
name: backfill-tags
on:
  workflow_dispatch:
    inputs:
      limit:
        description: '最多回補幾部 (預設 1000)'
        required: false
        default: '1000'

jobs:
  backfill:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: Run backfill
        run: npx tsx scripts/backfill-tags.ts --limit ${{ inputs.limit }}
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
```

- [ ] **Step 2：Commit AvBatch backfill workflow + script**

```powershell
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
git add scripts/backfill-tags.ts .github/workflows/backfill.yml
git commit -m "feat: 新增 backfill workflow_dispatch (支援 --limit 參數)"
```

### Task 13: AvCollect /api/admin/backfill route

**Files:**
- Create: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\app\api\admin\backfill\route.ts`

- [ ] **Step 1：寫 API**

完整檔案：

```ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GH_REPO = process.env.GITHUB_REPO; // 例 "yuhan/AvBatch"
const GH_TOKEN = process.env.GITHUB_TOKEN; // PAT with actions:write
const WORKFLOW = 'backfill.yml';

function envError() {
  if (!GH_REPO || !GH_TOKEN) {
    return NextResponse.json(
      { success: false, error: '伺服器未設置 GITHUB_REPO / GITHUB_TOKEN' },
      { status: 500 }
    );
  }
  return null;
}

const ghHeaders = () => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${GH_TOKEN}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

export async function GET() {
  const err = envError();
  if (err) return err;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`,
      { headers: ghHeaders(), cache: 'no-store' }
    );
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ success: false, error: `GitHub API ${res.status}: ${body}` }, { status: 502 });
    }
    const data = await res.json();
    const run = data.workflow_runs?.[0];
    return NextResponse.json({
      success: true,
      workflowUrl: `https://github.com/${GH_REPO}/actions/workflows/${WORKFLOW}`,
      latestRun: run
        ? {
            id: run.id,
            status: run.status, // queued | in_progress | completed
            conclusion: run.conclusion, // success | failure | null
            createdAt: run.created_at,
            url: run.html_url,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  const err = envError();
  if (err) return err;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'master', inputs: { limit: '1000' } }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ success: false, error: `GitHub API ${res.status}: ${body}` }, { status: 502 });
    }
    return NextResponse.json({
      success: true,
      dispatchedAt: new Date().toISOString(),
      workflowUrl: `https://github.com/${GH_REPO}/actions/workflows/${WORKFLOW}`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2：env 範例補上**

確認 `.env.local`（不要 commit）含：

```
GITHUB_REPO=yuhan/AvBatch
GITHUB_TOKEN=ghp_xxx (fine-grained PAT, actions:write to AvBatch repo only)
```

若有 `.env.example` 加註：

```
# GitHub fine-grained PAT for triggering backfill workflow (actions: write)
GITHUB_REPO=
GITHUB_TOKEN=
```

- [ ] **Step 3：驗證 typecheck**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
```

Expected：無錯誤。

### Task 14: SettingsView 加維護工具區塊

**Files:**
- Modify: `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\components\SettingsView.tsx`

- [ ] **Step 1：加 BackfillCard 子元件**

在 `SettingsView` 函式上方（同檔案）加：

```tsx
function BackfillCard() {
  const [latest, setLatest] = useState<{ status: string; conclusion: string | null; createdAt: string; url: string } | null>(null);
  const [workflowUrl, setWorkflowUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchedAt, setDispatchedAt] = useState(0);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backfill');
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? '查詢失敗');
      setLatest(data.latestRun);
      setWorkflowUrl(data.workflowUrl);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const dispatch = async () => {
    setDispatching(true);
    setError('');
    try {
      const res = await fetch('/api/admin/backfill', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? '觸發失敗');
      setDispatchedAt(Date.now());
      // GH 需幾秒才出現在 list
      setTimeout(refresh, 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="mb-1 flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-emerald-300" />
        <h2 className="text-base font-semibold">維護工具</h2>
      </div>
      <p className="mb-4 text-sm text-white/40">
        舊片標籤回補：對 tags 為空的舊片從詳情頁補抓真實標籤
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={dispatch}
          disabled={dispatching}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:shadow-emerald-500/40 active:scale-95 disabled:opacity-40"
        >
          {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          觸發背景補抓
        </button>
        {workflowUrl && (
          <a
            href={workflowUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            前往 GHA 查看進度
          </a>
        )}
      </div>

      <div className="mt-3 text-sm">
        {error && <span className="text-rose-400">{error}</span>}
        {dispatchedAt > 0 && !error && (
          <span className="text-emerald-300/80">已觸發 — GHA 約幾秒後出現在列表</span>
        )}
        {!error && latest && (
          <div className="mt-2 text-white/40">
            最近一次：{new Date(latest.createdAt).toLocaleString('zh-TW')} —{' '}
            {latest.status === 'completed' ? latest.conclusion ?? 'completed' : latest.status}
            {' · '}
            <a href={latest.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              查看 run
            </a>
          </div>
        )}
        {!error && !latest && !loading && <span className="text-white/30">尚無 run 紀錄</span>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2：補 lucide 與 useEffect import**

把既有 `import { ArrowLeft, Plus, X, Tag, Ban, Sparkles, Loader2, Check, Save } from 'lucide-react';` 改為：

```ts
import { ArrowLeft, Plus, X, Tag, Ban, Sparkles, Loader2, Check, Save, RefreshCw } from 'lucide-react';
```

把 `import { useMemo, useState } from 'react';` 改為：

```ts
import { useEffect, useMemo, useState } from 'react';
```

- [ ] **Step 3：在 JSX 最末段（MakerPrefixManager 後）渲染 BackfillCard**

```tsx
        <BackfillCard />
```

- [ ] **Step 4：驗證 typecheck + lint**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npx tsc --noEmit
npm run lint
```

Expected：兩個都通過。

- [ ] **Step 5：手動 smoke（僅 UI；實際觸發需設好 env）**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npm run dev
```

打開 `/settings`，預期：
- 看到「維護工具」卡片
- 若 GITHUB_TOKEN/REPO 未設 → 顯示「伺服器未設置」錯誤（可接受，等部署到 Vercel 設好）
- 若已設：列出最近一次 run 或「尚無 run 紀錄」；點按鈕 → 顯示「已觸發」

- [ ] **Step 6：Phase 6 Commit (AvCollect)**

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
git add src/app/api/admin/backfill/route.ts src/components/SettingsView.tsx
git commit -m "feat: 設定頁加一鍵 Backfill (觸發 AvBatch GHA workflow)"
```

---

## Phase 7 — 最終驗證與整理

### Task 15: 全量 build + lint 驗證

- [ ] **Step 1：AvCollect 完整 build**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
npm run lint
npm run build
```

Expected：兩個都成功（next build 含 typecheck）。

- [ ] **Step 2：AvBatch typecheck + smoke**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
npx tsc --noEmit
npm run check-taste
```

Expected：兩個都過。

### Task 16: 推到 remote

- [ ] **Step 1：AvCollect push**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
git push
```

- [ ] **Step 2：AvBatch push**

Run：

```powershell
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
git push
```

### Task 17: 更新記憶

- [ ] **Step 1：更新 taste-scoring-engine.md 註記 breakdown 已加入**

在 `C:\Users\c1471\.claude\projects\C--Users-c1471-Desktop-Projects-03-WebApps-AvCollect\memory\taste-scoring-engine.md` 文末加：

```
## 2026-05-26 更新
- `classify()` 回傳新增 `breakdown: { actress, issuer, themes }`，AvCollect Modal 顯示「完整評分明細」。AvBatch 不用 breakdown（Discord 仍用 reasons）。
- `blocked_issuers` 補上 UI：/settings 廠商分組勾選；scheduler 命中追蹤女優時豁免（與 blocked_tags 同邏輯）。
- Backfill 改走 GHA workflow_dispatch，可在 /settings 一鍵觸發。
```

- [ ] **Step 2：在 MEMORY.md 新增一行 backfill workflow 提示**

確認 `MEMORY.md` 末加：

```
- [Backfill Workflow](../skills/...) — 跑 backfill: AvCollect /settings 按鈕 → GHA workflow_dispatch (yuhan/AvBatch backfill.yml)
```

（如該檔已有對應條目則略過）

---

## 自我檢查（plan author）

- ✅ Spec 章節 1（動機）→ 由 Phase 3+4+5+6 共同實現
- ✅ Spec 章節 2（資料模型）→ Task 3+4 涵蓋 setConfigObject / makerMap merge
- ✅ Spec 章節 3.1（後端 API）→ Task 3+4
- ✅ Spec 章節 3.2（前端 UI）→ Task 5+6
- ✅ Spec 章節 3.3（scheduler 女優豁免）→ Task 7
- ✅ Spec 章節 3.4（評分明細）→ Task 1+8+9+10
- ✅ Spec 章節 3.5（Backfill）→ Task 11+12+13+14
- ✅ Spec 章節 7（驗收）→ Task 15+16

未涵蓋 spec 章節：無。

風險：
- AvCollect 部署到 Vercel 後需在 env 設 `GITHUB_REPO` 與 `GITHUB_TOKEN`；未設則 Backfill 按鈕報錯。Task 13 step 2 已標註。
- AvBatch 端 `npm run build` 不確定存在；備用 `npx tsc --noEmit`。Task 7 step 2 已標註。
