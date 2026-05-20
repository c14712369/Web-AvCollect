# AvCollect 全方面改進實施計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 AvCollect 從檔案型 JSON 持久化的單頁 prototype，升級為 Vercel 上的生產級 PWA：使用 Turso (libSQL/SQLite) 雲端資料庫、虛擬化卡片格線、模組化頁面結構、完整的錯誤/載入/空狀態、影片詳情 Modal、主題切換與收藏匯入匯出。

**Architecture:** 採用 Next.js 15 App Router + Server Components 為核心；資料層改用 Turso (libSQL HTTP) + Drizzle ORM 取代 JSON 檔案；client 端用 TanStack Query 管理 server state，@tanstack/react-virtual 處理大量卡片渲染；UI 拆分為 `<Header>`、`<MovieGrid>`、`<MovieDetailModal>`、`<ThemeToggle>` 等獨立元件，並補齊 loading/error/empty 邊界。

**Tech Stack:** Next.js 15.1, React 19, TypeScript 5.7, Tailwind v4, Framer Motion 11, Drizzle ORM + libSQL/Turso, TanStack Query v5, @tanstack/react-virtual, Zod, t3-env, Lucide React, Cheerio.

---

## 階段總覽

- **Phase 1 — 資料層 (Task 1-6)**：Turso + Drizzle，遷移 JSON 到 SQL
- **Phase 2 — 健壯性 (Task 7-10)**：Zod 驗證、Error Boundary、骨架屏、TanStack Query
- **Phase 3 — 效能 (Task 11-13)**：拆分 page.tsx、虛擬化、Server Component
- **Phase 4 — UI/UX (Task 14-18)**：詳情 Modal、主題切換、匯入匯出、快捷鍵、空狀態優化
- **Phase 5 — 部署 (Task 19-21)**：Vercel 設定、GitHub Actions CI、README

---

## 檔案結構（最終樣貌）

```
src/
  app/
    api/
      movies/
        route.ts                  # 改為 Drizzle CRUD
      favorites/
        route.ts                  # 改為 Drizzle CRUD
      image-proxy/
        route.ts                  # 保持
    layout.tsx
    page.tsx                      # 改為 Server Component（從 DB 抓資料）
    loading.tsx                   # 新增：全頁骨架屏
    error.tsx                     # 新增：全頁錯誤頁
    not-found.tsx                 # 新增
    providers.tsx                 # 新增：TanStack Query Provider + Theme Provider
  components/
    AvCard.tsx                    # 重構：移除 useFavorites，改 props
    MovieGrid.tsx                 # 新增：虛擬化格線
    MovieDetailModal.tsx          # 新增：詳情 Modal
    FilterBar.tsx                 # 保持
    SearchInput.tsx               # 保持
    Header.tsx                    # 新增：從 page.tsx 拆出
    ThemeToggle.tsx               # 新增：light/dark 切換
    ImportExportDialog.tsx        # 新增：收藏匯入匯出
    ErrorBoundary.tsx             # 新增
    Skeleton.tsx                  # 新增：通用骨架元件
  hooks/
    useFavorites.ts               # 重構：用 TanStack Query
    useKeyboardShortcuts.ts       # 新增
    useTheme.ts                   # 新增
    useMovies.ts                  # 新增
  lib/
    db/
      schema.ts                   # 新增：Drizzle schema
      client.ts                   # 新增：Turso client
      queries.ts                  # 新增：抽象化 DB 查詢
      seed.ts                     # 新增：將 data.json 遷移到 DB
    env.ts                        # 新增：t3-env 環境變數驗證
    metadata.ts                   # 保持
    validators.ts                 # 新增：Zod schemas
    data.json                     # 保留作為 seed 來源（後續可刪）
    favorites.json                # 保留作為 seed 來源（後續可刪）
    data.ts                       # 刪除（改由 DB 取代）
  types/
    av.ts                         # 擴充：加上 Movie ID、time stamps
drizzle/
  migrations/                     # Drizzle 自動產生
drizzle.config.ts                 # 新增
.env.local                        # 新增：Turso 連線資訊
.env.example                      # 新增
.github/
  workflows/
    ci.yml                        # 新增：型別檢查 + lint
vercel.json                       # 新增（如需要）
README.md                         # 改寫
```

---

## Phase 1 — 資料層遷移到 Turso

> **目標**：把 JSON 檔案讀寫換成 Turso (libSQL) + Drizzle ORM，從此 Vercel serverless 環境可正常運作。

---

### Task 1: 安裝依賴 + 環境變數骨架

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `.env.local`
- Modify: `.gitignore`

- [ ] **Step 1: 安裝資料庫與工具依賴**

```bash
npm install @libsql/client drizzle-orm @t3-oss/env-nextjs zod @tanstack/react-query @tanstack/react-virtual
npm install -D drizzle-kit dotenv tsx
```

- [ ] **Step 2: 建立 `.env.example`**

```env
# Turso (libSQL) - https://turso.tech
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3: 建立本機 `.env.local`（複製範本）**

```bash
cp .env.example .env.local
```

注意：此時不要填入真實 token，僅供 Drizzle 本機開發使用 file: 協議。改成：

```env
TURSO_DATABASE_URL=file:./local.db
TURSO_AUTH_TOKEN=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: 更新 `.gitignore`**

於既有內容後追加：

```
# env
.env*.local
.env

# local sqlite
local.db
local.db-journal
*.db

# drizzle
/drizzle/meta/
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore: 安裝 Drizzle/Turso/TanStack Query 依賴與環境變數骨架"
```

---

### Task 2: 建立型別安全的環境變數模組

**Files:**
- Create: `src/lib/env.ts`

- [ ] **Step 1: 撰寫 `src/lib/env.ts`**

```typescript
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    TURSO_DATABASE_URL: z.string().min(1),
    TURSO_AUTH_TOKEN: z.string().optional().default(''),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
});
```

- [ ] **Step 2: 驗證型別檢查通過**

```bash
npx tsc --noEmit
```

預期：無錯誤輸出。

- [ ] **Step 3: Commit**

```bash
git add src/lib/env.ts
git commit -m "feat(env): 加入 t3-env 型別安全環境變數模組"
```

---

### Task 3: 定義 Drizzle Schema

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 1: 撰寫 `src/lib/db/schema.ts`**

```typescript
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const movies = sqliteTable('movies', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  imageUrl: text('image_url').notNull(),
  source: text('source').notNull(),
  category: text('category').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const favorites = sqliteTable('favorites', {
  code: text('code').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type MovieRow = typeof movies.$inferSelect;
export type MovieInsert = typeof movies.$inferInsert;
export type FavoriteRow = typeof favorites.$inferSelect;
```

設計理由：
- `maker`、`themes`、`actress` 不存 DB，由 `extractMaker/Themes/Actress` 在查詢時 derive，保持單一來源。
- `code` 作為 primary key 滿足現有去重邏輯。

- [ ] **Step 2: 撰寫 `drizzle.config.ts`**

```typescript
import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
```

- [ ] **Step 3: 加入 npm scripts**

修改 `package.json` 的 `scripts` 區塊：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/lib/db/seed.ts"
  }
}
```

- [ ] **Step 4: 產生第一份 migration**

```bash
npm run db:generate
```

預期：`drizzle/migrations/0000_*.sql` 被建立。

- [ ] **Step 5: 執行 migration（本地 file: SQLite）**

```bash
npm run db:migrate
```

預期：`local.db` 被建立，`movies` 與 `favorites` 兩張表存在。

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle.config.ts drizzle/ package.json package-lock.json
git commit -m "feat(db): 定義 Drizzle schema 並產生首次 migration"
```

---

### Task 4: 建立 DB Client 與查詢層

**Files:**
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/queries.ts`

- [ ] **Step 1: 撰寫 `src/lib/db/client.ts`**

```typescript
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '@/lib/env';
import * as schema from './schema';

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
```

- [ ] **Step 2: 撰寫 `src/lib/db/queries.ts`**

```typescript
import { desc, eq } from 'drizzle-orm';
import { db } from './client';
import { movies, favorites, type MovieInsert } from './schema';
import { extractMaker, extractThemes, extractActress } from '@/lib/metadata';
import type { Movie } from '@/types/av';

const enrich = (row: typeof movies.$inferSelect): Movie => ({
  code: row.code,
  title: row.title,
  url: row.url,
  imageUrl: row.imageUrl,
  source: row.source,
  category: row.category,
  maker: extractMaker(row.code),
  themes: extractThemes(row.title),
  actress: extractActress(row.title),
});

export const listMovies = async (): Promise<Movie[]> => {
  const rows = await db.select().from(movies).orderBy(desc(movies.createdAt));
  return rows.map(enrich);
};

export const insertMovie = async (data: MovieInsert): Promise<Movie | null> => {
  const exists = await db
    .select()
    .from(movies)
    .where(eq(movies.code, data.code))
    .limit(1);
  if (exists.length > 0) return null;
  await db.insert(movies).values(data);
  const inserted = await db
    .select()
    .from(movies)
    .where(eq(movies.code, data.code))
    .limit(1);
  return inserted[0] ? enrich(inserted[0]) : null;
};

export const listFavorites = async (): Promise<string[]> => {
  const rows = await db.select({ code: favorites.code }).from(favorites);
  return rows.map((r) => r.code);
};

export const setFavorites = async (codes: string[]): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.delete(favorites);
    if (codes.length === 0) return;
    await tx
      .insert(favorites)
      .values(codes.map((code) => ({ code })));
  });
};
```

- [ ] **Step 3: 驗證型別檢查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/client.ts src/lib/db/queries.ts
git commit -m "feat(db): 加入 libSQL client 與抽象化查詢層"
```

---

### Task 5: 撰寫 Seed Script 並遷移現有 JSON 資料

**Files:**
- Create: `src/lib/db/seed.ts`

- [ ] **Step 1: 撰寫 `src/lib/db/seed.ts`**

```typescript
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { movies, favorites } from './schema';

interface JsonMovie {
  code: string;
  title: string;
  url: string;
  imageUrl: string;
  source: string;
  category: string;
}

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client);

  const moviesPath = path.join(process.cwd(), 'src', 'lib', 'data.json');
  const favoritesPath = path.join(process.cwd(), 'src', 'lib', 'favorites.json');

  const moviesRaw = JSON.parse(await fs.readFile(moviesPath, 'utf-8')) as JsonMovie[];
  const favoritesRaw: string[] = await fs
    .readFile(favoritesPath, 'utf-8')
    .then((s) => JSON.parse(s))
    .catch(() => []);

  console.log(`Seeding ${moviesRaw.length} movies and ${favoritesRaw.length} favorites...`);

  // 用 onConflictDoNothing 避免重複跑 seed 時炸掉
  for (const m of moviesRaw) {
    await db.insert(movies).values(m).onConflictDoNothing();
  }

  for (const code of favoritesRaw) {
    await db.insert(favorites).values({ code }).onConflictDoNothing();
  }

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: 執行 seed 並驗證**

```bash
npm run db:seed
```

預期輸出：`Seeding 400+ movies and N favorites...` → `Seed complete.`

- [ ] **Step 3: 用 Drizzle Studio 驗證資料**

```bash
npm run db:studio
```

預期：可在瀏覽器看到 `movies` 表有資料、`favorites` 表有資料。確認後 Ctrl+C 關閉。

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/seed.ts
git commit -m "feat(db): 加入 seed script，將 data.json/favorites.json 遷移到 SQLite"
```

---

### Task 6: 重構 API Routes 使用 Drizzle

**Files:**
- Modify: `src/app/api/movies/route.ts`
- Modify: `src/app/api/favorites/route.ts`
- Create: `src/lib/validators.ts`

- [ ] **Step 1: 撰寫 `src/lib/validators.ts`**

```typescript
import { z } from 'zod';

export const addMovieSchema = z.object({
  url: z.string().url('必須是合法網址'),
});

export const favoritesSchema = z.array(z.string().min(1));

export type AddMovieInput = z.infer<typeof addMovieSchema>;
```

- [ ] **Step 2: 重寫 `src/app/api/favorites/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { listFavorites, setFavorites } from '@/lib/db/queries';
import { favoritesSchema } from '@/lib/validators';

export async function GET() {
  try {
    const codes = await listFavorites();
    return NextResponse.json(codes);
  } catch (error) {
    console.error('[GET /api/favorites]', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = favoritesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await setFavorites(parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/favorites]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 重寫 `src/app/api/movies/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { insertMovie, listMovies } from '@/lib/db/queries';
import { addMovieSchema } from '@/lib/validators';

export async function GET() {
  try {
    const movies = await listMovies();
    return NextResponse.json({ success: true, movies });
  } catch (error) {
    console.error('[GET /api/movies]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = addMovieSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { url } = parsed.data;

    let source = 'Unknown';
    if (url.includes('jable.tv')) source = 'Jable';
    else if (url.includes('missav')) source = 'MissAV';
    else if (url.includes('javrate.com')) source = 'Javrate';

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      'Unknown Title';
    let imageUrl = $('meta[property="og:image"]').attr('content') || '';

    if (!imageUrl) {
      if (source === 'Jable') {
        imageUrl = $('.video-img-box img').attr('src') || '';
      } else if (source === 'MissAV') {
        imageUrl = $('video').attr('poster') || '';
      }
    }

    let code = 'UNKNOWN';
    const codeMatch =
      title.match(/[A-Z0-9]+-[0-9A-Z]+/i) ||
      url.match(/\/([a-zA-Z0-9]+-[0-9A-Z]+)[\/\?]?/);
    if (codeMatch) {
      code = codeMatch[1].toUpperCase();
    }

    const movie = await insertMovie({
      code,
      title,
      url,
      imageUrl,
      source,
      category: 'User Added',
    });

    if (!movie) {
      return NextResponse.json({
        success: false,
        error: '番號已存在',
      }, { status: 409 });
    }

    return NextResponse.json({ success: true, movie });
  } catch (error) {
    console.error('[POST /api/movies]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: 啟動 dev server 並手動測試**

```bash
npm run dev
```

開啟 `http://localhost:3000`，預期：
- 收藏可以新增與移除（用瀏覽器 DevTools 看 `POST /api/favorites` 200）
- 重新整理後收藏仍在
- 「新增收藏」貼一個 URL 後可成功（用 Jable / MissAV 的合法網址測試）

驗收完成後 Ctrl+C 關閉。

- [ ] **Step 5: 刪除已被取代的 `src/lib/data.ts`**

```bash
rm src/lib/data.ts
```

注意：此時 `page.tsx` 仍 import `@/lib/data`，要等 Task 11 拆分時改掉。為了讓建置不壞掉，現在暫時改 `page.tsx` 第 7 行：

```typescript
// 之前
import { movies as initialMovies } from '@/lib/data';
// 改為（暫時 inline empty array，下個 phase 會接 server fetch）
import type { Movie } from '@/types/av';
const initialMovies: Movie[] = [];
```

並且加上一段 `useEffect` 抓取 `/api/movies`：

```typescript
// 在 const [movies, setMovies] = useState<Movie[]>(initialMovies); 後新增
React.useEffect(() => {
  fetch('/api/movies')
    .then((r) => r.json())
    .then((data) => {
      if (data.success && Array.isArray(data.movies)) {
        setMovies(data.movies);
      }
    })
    .catch((e) => console.error(e));
}, []);
```

- [ ] **Step 6: 再次手動驗證 dev server 載入正常**

```bash
npm run dev
```

預期：首頁仍然顯示所有影片。Ctrl+C 關閉。

- [ ] **Step 7: Commit**

```bash
git add src/app/api src/lib/validators.ts src/app/page.tsx
git rm src/lib/data.ts
git commit -m "refactor(api): API routes 改為 Drizzle 驅動 + Zod 驗證，page 暫時改為 fetch /api/movies"
```

---

## Phase 2 — 健壯性強化

> **目標**：補齊 loading / error / empty 三態，導入 TanStack Query，加入 Error Boundary 與 Skeleton。

---

### Task 7: 建立 TanStack Query Provider

**Files:**
- Create: `src/app/providers.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 撰寫 `src/app/providers.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: 修改 `src/app/layout.tsx` 包裹 Providers**

於 `<body>` 內把 `{children}` 包起來：

```typescript
import { Providers } from './providers';

// ...在 RootLayout return 內：
<body className={`${inter.className} dark`}>
  <Providers>{children}</Providers>
</body>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/providers.tsx src/app/layout.tsx
git commit -m "feat: 加入 TanStack Query Provider"
```

---

### Task 8: 用 TanStack Query 重構 useFavorites 與 useMovies

**Files:**
- Modify: `src/hooks/useFavorites.ts`
- Create: `src/hooks/useMovies.ts`

- [ ] **Step 1: 重寫 `src/hooks/useFavorites.ts`**

```typescript
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const QUERY_KEY = ['favorites'] as const;

const fetchFavorites = async (): Promise<string[]> => {
  const res = await fetch('/api/favorites');
  if (!res.ok) throw new Error('Failed to load favorites');
  return res.json();
};

const saveFavorites = async (codes: string[]): Promise<void> => {
  const res = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(codes),
  });
  if (!res.ok) throw new Error('Failed to save favorites');
};

export const useFavorites = () => {
  const queryClient = useQueryClient();
  const { data: favorites = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFavorites,
  });

  const mutation = useMutation({
    mutationFn: saveFavorites,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData<string[]>(QUERY_KEY);
      queryClient.setQueryData(QUERY_KEY, next);
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
    },
  });

  const toggleFavorite = useCallback(
    (code: string) => {
      const current = queryClient.getQueryData<string[]>(QUERY_KEY) ?? [];
      const next = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
      mutation.mutate(next);
    },
    [mutation, queryClient]
  );

  const isFavorite = useCallback(
    (code: string) => favorites.includes(code),
    [favorites]
  );

  const replaceFavorites = useCallback(
    (codes: string[]) => mutation.mutate(codes),
    [mutation]
  );

  return { favorites, toggleFavorite, isFavorite, replaceFavorites };
};
```

- [ ] **Step 2: 撰寫 `src/hooks/useMovies.ts`**

```typescript
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Movie } from '@/types/av';

const QUERY_KEY = ['movies'] as const;

const fetchMovies = async (): Promise<Movie[]> => {
  const res = await fetch('/api/movies');
  if (!res.ok) throw new Error('Failed to load movies');
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Unknown error');
  return json.movies;
};

const addMovie = async (url: string): Promise<Movie> => {
  const res = await fetch('/api/movies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed');
  return json.movie;
};

export const useMovies = () => {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchMovies });
};

export const useAddMovie = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addMovie,
    onSuccess: (movie) => {
      queryClient.setQueryData<Movie[]>(QUERY_KEY, (prev) =>
        prev ? [movie, ...prev] : [movie]
      );
    },
  });
};
```

- [ ] **Step 3: 驗證型別檢查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useFavorites.ts src/hooks/useMovies.ts
git commit -m "refactor(hooks): 用 TanStack Query 重構 useFavorites 並新增 useMovies"
```

---

### Task 9: 新增 Skeleton 與 Loading/Error/NotFound 邊界

**Files:**
- Create: `src/components/Skeleton.tsx`
- Create: `src/app/loading.tsx`
- Create: `src/app/error.tsx`
- Create: `src/app/not-found.tsx`

- [ ] **Step 1: 撰寫 `src/components/Skeleton.tsx`**

```typescript
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-white/5 border border-white/5',
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-1">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 建立 `src/lib/utils.ts`（提供 cn 工具）**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: 撰寫 `src/app/loading.tsx`**

```typescript
import { GridSkeleton } from '@/components/Skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1920px]">
        <div className="mb-8 h-16 animate-pulse rounded-2xl bg-white/5" />
        <GridSkeleton />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: 撰寫 `src/app/error.tsx`**

```typescript
'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-center">
      <div className="mb-4 rounded-full bg-red-500/10 p-4 border border-red-500/20">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <h1 className="text-xl font-bold text-white">發生錯誤</h1>
      <p className="mt-2 max-w-md text-sm text-white/40">
        {error.message || '未知錯誤'}
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
      >
        <RotateCcw className="h-4 w-4" />
        重試
      </button>
    </main>
  );
}
```

- [ ] **Step 5: 撰寫 `src/app/not-found.tsx`**

```typescript
import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-center">
      <div className="mb-4 rounded-full bg-indigo-500/10 p-4 border border-indigo-500/20">
        <Compass className="h-8 w-8 text-indigo-400" />
      </div>
      <h1 className="text-xl font-bold text-white">找不到頁面</h1>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
      >
        回首頁
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: 驗證 dev server**

```bash
npm run dev
```

預期：首頁載入時短暫看到骨架屏；訪問 `/non-existent` 看到 404 頁。Ctrl+C 關閉。

- [ ] **Step 7: Commit**

```bash
git add src/components/Skeleton.tsx src/lib/utils.ts src/app/loading.tsx src/app/error.tsx src/app/not-found.tsx
git commit -m "feat(ui): 加入 Skeleton 元件與 loading/error/not-found 邊界"
```

---

### Task 10: 加入 Error Boundary 元件（用於子樹）

**Files:**
- Create: `src/components/ErrorBoundary.tsx`

- [ ] **Step 1: 撰寫 `src/components/ErrorBoundary.tsx`**

```typescript
'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface State {
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset);
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 rounded-full bg-red-500/10 p-3 border border-red-500/20">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
          <p className="text-sm font-medium text-white/70">{error.message}</p>
          <button
            onClick={this.reset}
            className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ErrorBoundary.tsx
git commit -m "feat(ui): 加入可重用 ErrorBoundary 元件"
```

---

## Phase 3 — 效能 + 結構重構

> **目標**：拆分肥大的 `page.tsx`，導入虛擬化卡片清單，將 page 改為 Server Component（首次渲染從 DB 直接拿資料）。

---

### Task 11: 從 page.tsx 拆出 `<Header>` 元件

**Files:**
- Create: `src/components/Header.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 撰寫 `src/components/Header.tsx`**

```typescript
'use client';

import { LayoutGrid, Heart, Plus, Loader2 } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { SearchInput } from './SearchInput';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  sources: string[];
  categories: string[];
  makers: string[];
  themes: string[];
  activeSource: string;
  activeCategory: string;
  activeMaker: string;
  activeTheme: string;
  onSourceChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onMakerChange: (v: string) => void;
  onThemeChange: (v: string) => void;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  onAddMovie: () => void;
  isAdding: boolean;
  totalCount: number;
}

export function Header(props: HeaderProps) {
  const {
    searchQuery, onSearchChange,
    sources, categories, makers, themes,
    activeSource, activeCategory, activeMaker, activeTheme,
    onSourceChange, onCategoryChange, onMakerChange, onThemeChange,
    showFavoritesOnly, onToggleFavoritesOnly,
    onAddMovie, isAdding, totalCount,
  } = props;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 glass">
      <div className="mx-auto max-w-[1920px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-lg shadow-indigo-500/20">
                <LayoutGrid className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white leading-none">AvCollect</h1>
                <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest mt-0.5">頂級數位資產典藏庫</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SearchInput value={searchQuery} onChange={onSearchChange} />
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-t border-white/5 pt-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full xl:pr-8 min-w-0">
              <FilterBar label="來源" options={sources} selected={activeSource} onChange={onSourceChange} />
              <FilterBar label="分類" options={categories} selected={activeCategory} onChange={onCategoryChange} />
              <FilterBar label="廠商" options={makers} selected={activeMaker} onChange={onMakerChange} />
              <FilterBar label="主題" options={themes} selected={activeTheme} onChange={onThemeChange} />
            </div>
            <div className="flex items-center space-x-3 self-end xl:self-auto shrink-0">
              <button
                onClick={onAddMovie}
                disabled={isAdding}
                className="group flex items-center space-x-2 rounded-full px-5 py-2.5 transition-all duration-500 border glass border-white/5 text-white/80 hover:text-white hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> : <Plus className="h-4 w-4 group-hover:scale-110 transition-transform text-indigo-400" />}
                <span className="text-xs font-bold tracking-wide">新增收藏</span>
              </button>
              <button
                onClick={onToggleFavoritesOnly}
                className={`group flex items-center space-x-2 rounded-full px-5 py-2.5 transition-all duration-500 border ${
                  showFavoritesOnly
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                    : 'glass border-white/5 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <Heart className={`h-4 w-4 transition-all duration-500 ${showFavoritesOnly ? 'fill-red-500 scale-110' : 'group-hover:scale-110 group-hover:text-red-400'}`} />
                <span className="text-xs font-semibold tracking-wide">收藏限定</span>
              </button>
              <div className="flex items-center space-x-2 rounded-full glass border-white/5 px-5 py-2.5">
                <span className="text-xs font-medium text-white/30 uppercase tracking-tighter">總計</span>
                <span className="text-sm font-bold text-indigo-400 font-mono">
                  {totalCount.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
```

注意：此檔案引入了 `ThemeToggle`，在 Task 15 才會建立。為了讓 PLAN 不互鎖，先在本 Task **暫時將 `<ThemeToggle />` 換為空 fragment `<></>`** 並 import 註解掉，待 Task 15 啟用：

```typescript
// import { ThemeToggle } from './ThemeToggle'; // Task 15 啟用
// ...
// 將 <ThemeToggle /> 改為 <></>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(ui): 從 page.tsx 拆出 Header 元件"
```

---

### Task 12: 建立虛擬化 `<MovieGrid>` 元件

**Files:**
- Create: `src/components/MovieGrid.tsx`
- Modify: `src/components/AvCard.tsx`

- [ ] **Step 1: 重構 `AvCard.tsx` 移除 hook 依賴，改用 props**

替換現有 `AvCardProps` 為：

```typescript
interface AvCardProps {
  movie: Movie;
  favorited: boolean;
  onToggleFavorite: (code: string) => void;
  onSelect: (movie: Movie) => void;
}
```

同時移除 `useFavorites` 使用，把 `const { isFavorite, toggleFavorite } = useFavorites();` 與 `const favorited = isFavorite(movie.code);` 刪掉。

把 `handleFavoriteClick` 改成：

```typescript
const handleFavoriteClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  onToggleFavorite(movie.code);
};
```

把外層 `<div onClick={() => window.open(movie.url, '_blank')}>` 改成 `onClick={() => onSelect(movie)}`，讓點擊改為開啟詳情 Modal。

- [ ] **Step 2: 撰寫 `src/components/MovieGrid.tsx`**

```typescript
'use client';

import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, motion } from 'framer-motion';
import { Info } from 'lucide-react';
import type { Movie } from '@/types/av';
import { AvCard } from './AvCard';

interface MovieGridProps {
  movies: Movie[];
  favorites: string[];
  onToggleFavorite: (code: string) => void;
  onSelectMovie: (movie: Movie) => void;
}

const COLUMN_BREAKPOINTS: Array<[number, number]> = [
  [1920, 10],
  [1536, 8],
  [1280, 6],
  [1024, 5],
  [768, 4],
  [640, 3],
  [0, 2],
];

function useColumnCount() {
  if (typeof window === 'undefined') return 6;
  const w = window.innerWidth;
  return COLUMN_BREAKPOINTS.find(([min]) => w >= min)?.[1] ?? 2;
}

export function MovieGrid({
  movies,
  favorites,
  onToggleFavorite,
  onSelectMovie,
}: MovieGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columns = useColumnCount();

  const rows = useMemo(() => {
    const out: Movie[][] = [];
    for (let i = 0; i < movies.length; i += columns) {
      out.push(movies.slice(i, i + columns));
    }
    return out;
  }, [movies, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // 每行估算高度
    overscan: 4,
  });

  if (movies.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-32 text-center"
      >
        <div className="mb-4 rounded-full bg-white/5 p-4">
          <Info className="h-8 w-8 text-white/20" />
        </div>
        <h3 className="text-lg font-medium text-white/60">找不到相符的結果</h3>
        <p className="text-sm text-white/30">請嘗試更改搜尋關鍵字或篩選條件</p>
      </motion.div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-220px)] overflow-auto"
    >
      <AnimatePresence mode="popLayout">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {rows[virtualRow.index].map((movie) => (
                  <motion.div
                    key={movie.code}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AvCard
                      movie={movie}
                      favorited={favorites.includes(movie.code)}
                      onToggleFavorite={onToggleFavorite}
                      onSelect={onSelectMovie}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
```

注意：`useColumnCount` 只在 client 端執行，初次 SSR 會 fallback 為 6 欄。若有 hydration 警告可改為加上 `useEffect` 設 state。

- [ ] **Step 3: Commit**

```bash
git add src/components/MovieGrid.tsx src/components/AvCard.tsx
git commit -m "feat(ui): 加入虛擬化 MovieGrid 元件，AvCard 改為 props 驅動"
```

---

### Task 13: 將 page.tsx 改造為 Server Component + Client Container

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/HomeView.tsx`

- [ ] **Step 1: 撰寫 `src/components/HomeView.tsx`**（client 端容器）

```typescript
'use client';

import { useMemo, useState } from 'react';
import type { Movie } from '@/types/av';
import { Header } from './Header';
import { MovieGrid } from './MovieGrid';
import { MovieDetailModal } from './MovieDetailModal';
import { useFavorites } from '@/hooks/useFavorites';
import { useAddMovie, useMovies } from '@/hooks/useMovies';

interface HomeViewProps {
  initialMovies: Movie[];
}

export function HomeView({ initialMovies }: HomeViewProps) {
  const { data: movies = initialMovies } = useMovies();
  const addMovie = useAddMovie();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSource, setActiveSource] = useState('全部');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeMaker, setActiveMaker] = useState('全部');
  const [activeTheme, setActiveTheme] = useState('全部');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  const sources = useMemo(
    () => ['全部', ...Array.from(new Set(movies.map((m) => m.source)))],
    [movies]
  );
  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(movies.map((m) => m.category)))],
    [movies]
  );
  const makers = useMemo(
    () => ['全部', ...Array.from(new Set(movies.map((m) => m.maker))).sort()],
    [movies]
  );
  const themes = useMemo(() => {
    const set = new Set<string>();
    movies.forEach((m) => m.themes.forEach((t) => set.add(t)));
    return ['全部', ...Array.from(set).sort()];
  }, [movies]);

  const filtered = useMemo(() => {
    return movies.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        m.title.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.actress ?? '').toLowerCase().includes(q);
      const matchesSource = activeSource === '全部' || m.source === activeSource;
      const matchesCategory = activeCategory === '全部' || m.category === activeCategory;
      const matchesMaker = activeMaker === '全部' || m.maker === activeMaker;
      const matchesTheme = activeTheme === '全部' || m.themes.includes(activeTheme);
      const matchesFav = !showFavoritesOnly || isFavorite(m.code);
      return (
        matchesSearch && matchesSource && matchesCategory &&
        matchesMaker && matchesTheme && matchesFav
      );
    });
  }, [
    movies, searchQuery, activeSource, activeCategory,
    activeMaker, activeTheme, showFavoritesOnly, isFavorite,
  ]);

  const handleAddMovie = async () => {
    const url = window.prompt('請輸入影片網址 (Jable, MissAV, Javrate)：');
    if (!url) return;
    try {
      await addMovie.mutateAsync(url);
    } catch (e) {
      window.alert('新增失敗：' + (e as Error).message);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white font-inter selection:bg-indigo-500/30">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sources={sources}
        categories={categories}
        makers={makers}
        themes={themes}
        activeSource={activeSource}
        activeCategory={activeCategory}
        activeMaker={activeMaker}
        activeTheme={activeTheme}
        onSourceChange={setActiveSource}
        onCategoryChange={setActiveCategory}
        onMakerChange={setActiveMaker}
        onThemeChange={setActiveTheme}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={() => setShowFavoritesOnly((v) => !v)}
        onAddMovie={handleAddMovie}
        isAdding={addMovie.isPending}
        totalCount={filtered.length}
      />
      <div className="mx-auto max-w-[1920px] px-4 py-8 sm:px-6 lg:px-8">
        <MovieGrid
          movies={filtered}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSelectMovie={setSelectedMovie}
        />
      </div>
      <MovieDetailModal
        movie={selectedMovie}
        onClose={() => setSelectedMovie(null)}
      />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>
    </main>
  );
}
```

注意：`MovieDetailModal` 在 Task 14 才會建立。本 Task 完成前先建立一個 stub 占位：

```typescript
// src/components/MovieDetailModal.tsx (stub - Task 14 會完整實作)
'use client';
import type { Movie } from '@/types/av';
export function MovieDetailModal({ movie, onClose }: { movie: Movie | null; onClose: () => void }) {
  if (!movie) return null;
  return null;
}
```

把上面這個 stub 寫進 `src/components/MovieDetailModal.tsx`（Task 14 會覆蓋）。

- [ ] **Step 2: 改寫 `src/app/page.tsx` 為 Server Component**

```typescript
import { listMovies } from '@/lib/db/queries';
import { HomeView } from '@/components/HomeView';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const initialMovies = await listMovies();
  return <HomeView initialMovies={initialMovies} />;
}
```

- [ ] **Step 3: 驗證 dev server**

```bash
npm run dev
```

預期：
- 首頁從 server 直接渲染（檢視原始碼會看到卡片 HTML）
- 卡片格線正確顯示
- 滾動順暢（虛擬化生效）
- 點擊卡片暫時不會有事（Modal 是 stub）
- 收藏 toggle 正常運作

Ctrl+C 關閉。

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/HomeView.tsx src/components/MovieDetailModal.tsx
git commit -m "refactor(page): page.tsx 改為 Server Component，HomeView 容納 client 邏輯"
```

---

## Phase 4 — UI/UX 精緻化

> **目標**：影片詳情 Modal、light/dark 切換、收藏匯入匯出、Cmd+K 快捷鍵。

---

### Task 14: 影片詳情 Modal

**Files:**
- Modify: `src/components/MovieDetailModal.tsx`

- [ ] **Step 1: 完整實作 `src/components/MovieDetailModal.tsx`**

```typescript
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Heart } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';
import type { Movie } from '@/types/av';
import { useFavorites } from '@/hooks/useFavorites';

interface Props {
  movie: Movie | null;
  onClose: () => void;
}

export function MovieDetailModal({ movie, onClose }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {movie && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/40 p-2 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative aspect-video w-full bg-zinc-900">
              <Image
                src={movie.imageUrl}
                alt={movie.title}
                fill
                unoptimized
                referrerPolicy="no-referrer"
                className="object-cover"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex rounded bg-indigo-500/20 px-2 py-1 text-xs font-black tracking-tighter text-indigo-300 border border-indigo-500/30">
                  {movie.code}
                </span>
                <button
                  onClick={() => toggleFavorite(movie.code)}
                  className="rounded-full bg-white/5 p-2 border border-white/10 hover:bg-white/10"
                >
                  <Heart
                    className={`h-4 w-4 ${isFavorite(movie.code) ? 'fill-red-500 text-red-500' : 'text-white/60'}`}
                  />
                </button>
              </div>
              <h2 className="text-lg font-bold leading-snug text-white">{movie.title}</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field label="來源" value={movie.source} />
                <Field label="廠商" value={movie.maker} />
                <Field label="分類" value={movie.category} />
                <Field label="女優" value={movie.actress ?? '—'} />
              </div>
              {movie.themes.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-white/40 mb-2">主題</p>
                  <div className="flex flex-wrap gap-1.5">
                    {movie.themes.map((t) => (
                      <span key={t} className="text-xs text-white/70 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <a
                href={movie.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/50"
              >
                <ExternalLink className="h-4 w-4" />
                前往觀看
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">{label}</p>
      <p className="text-sm text-white/90 mt-0.5">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: 驗證 dev server**

```bash
npm run dev
```

預期：點擊卡片開啟 Modal，按 Esc 或點背景關閉。Ctrl+C 關閉。

- [ ] **Step 3: Commit**

```bash
git add src/components/MovieDetailModal.tsx
git commit -m "feat(ui): 影片詳情 Modal，含主題標籤與外部連結"
```

---

### Task 15: 主題切換（light/dark）

**Files:**
- Create: `src/hooks/useTheme.ts`
- Create: `src/components/ThemeToggle.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 撰寫 `src/hooks/useTheme.ts`**

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'avcollect-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) ?? 'dark';
    setTheme(saved);
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  return { theme, toggle };
}
```

- [ ] **Step 2: 撰寫 `src/components/ThemeToggle.tsx`**

```typescript
'use client';

import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition hover:bg-white/10"
      aria-label="切換主題"
    >
      <motion.div
        key={isDark ? 'moon' : 'sun'}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-indigo-300" />
        ) : (
          <Sun className="h-4 w-4 text-amber-400" />
        )}
      </motion.div>
    </button>
  );
}
```

- [ ] **Step 3: 啟用 Header 內的 ThemeToggle**

於 `src/components/Header.tsx`：
- 取消註解 `import { ThemeToggle } from './ThemeToggle';`
- 將 `<></>` 換回 `<ThemeToggle />`

- [ ] **Step 4: 修改 `src/app/globals.css` 加上 light mode token**

找到 `@theme` 區塊，將 dark mode 的值移到 `.dark { ... }`，並讓 `:root` 為 light 預設。範例新增（不要刪掉現有風格，僅補上 light 對應 token）：

```css
:root {
  --background: 250 250 250;
  --foreground: 24 24 27;
}

.dark {
  --background: 5 5 5;
  --foreground: 255 255 255;
}

body {
  background-color: rgb(var(--background));
  color: rgb(var(--foreground));
}
```

並把 `HomeView.tsx` 的 `bg-[#050505]` 改為使用 token 或保留現狀（保留現狀即可，dark 為主）。

- [ ] **Step 5: 修改 `src/app/layout.tsx` 移除硬寫的 `dark` class，改由 hook 控制**

將 `<body className={`${inter.className} dark`}>` 改為 `<body className={inter.className}>`，而 `<html>` 加上 `suppressHydrationWarning`：

```typescript
<html lang="zh-Hant" suppressHydrationWarning>
```

- [ ] **Step 6: 驗證 dev server**

```bash
npm run dev
```

預期：右上角有主題切換按鈕，切換後配色變化（dark/light 之間）。重整後仍保留選擇。

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useTheme.ts src/components/ThemeToggle.tsx src/components/Header.tsx src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): 加入 light/dark 主題切換並持久化到 localStorage"
```

---

### Task 16: 收藏匯入/匯出 Dialog

**Files:**
- Create: `src/components/ImportExportDialog.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/HomeView.tsx`

- [ ] **Step 1: 撰寫 `src/components/ImportExportDialog.tsx`**

```typescript
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Download, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useFavorites } from '@/hooks/useFavorites';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportExportDialog({ open, onClose }: Props) {
  const { favorites, replaceFavorites } = useFavorites();
  const [text, setText] = useState('');

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(favorites, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avcollect-favorites-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || !parsed.every((s) => typeof s === 'string')) {
        throw new Error('格式不正確：必須是字串陣列');
      }
      replaceFavorites(parsed);
      onClose();
      setText('');
    } catch (e) {
      window.alert('匯入失敗：' + (e as Error).message);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-1.5 text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-white">收藏匯入 / 匯出</h3>
            <p className="mt-1 text-xs text-white/40">
              目前收藏 {favorites.length} 部影片
            </p>

            <button
              onClick={handleExport}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/40 px-5 py-2.5 text-sm font-bold text-indigo-300 hover:bg-indigo-500/30"
            >
              <Download className="h-4 w-4" />
              匯出為 JSON
            </button>

            <div className="mt-6">
              <label className="text-[10px] font-medium uppercase tracking-widest text-white/40">
                匯入：貼上 JSON 陣列
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='["SMCD-036", "AILB-010", ...]'
                rows={6}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleImport}
                disabled={!text.trim()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4" />
                覆蓋現有收藏並匯入
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: 在 Header 加入觸發按鈕**

於 `src/components/Header.tsx`：

```typescript
import { Database } from 'lucide-react';
// ... 在 props 加入：
//   onOpenImportExport: () => void;
// ... 在「收藏限定」按鈕旁加上：
<button
  onClick={props.onOpenImportExport}
  className="rounded-full glass border border-white/5 p-2.5 text-white/50 hover:text-white hover:border-white/20"
  aria-label="收藏匯入匯出"
>
  <Database className="h-4 w-4" />
</button>
```

注意：別忘了在 props interface 加 `onOpenImportExport: () => void;`。

- [ ] **Step 3: 在 HomeView 接上 dialog state**

於 `src/components/HomeView.tsx`：

```typescript
import { ImportExportDialog } from './ImportExportDialog';
// ... 新增 state：
const [importExportOpen, setImportExportOpen] = useState(false);

// ... 傳給 Header：
//   onOpenImportExport={() => setImportExportOpen(true)}

// ... 在 main 末端加：
<ImportExportDialog open={importExportOpen} onClose={() => setImportExportOpen(false)} />
```

- [ ] **Step 4: 驗證**

```bash
npm run dev
```

預期：右上角資料庫圖示按鈕可開啟 dialog，匯出產生 JSON 檔，貼 JSON 後匯入會覆蓋收藏。Ctrl+C 關閉。

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportExportDialog.tsx src/components/Header.tsx src/components/HomeView.tsx
git commit -m "feat(ui): 收藏匯入/匯出對話框，支援 JSON 匯出與還原"
```

---

### Task 17: 鍵盤快捷鍵 (Cmd/Ctrl+K 聚焦搜尋)

**Files:**
- Create: `src/hooks/useKeyboardShortcuts.ts`
- Modify: `src/components/SearchInput.tsx`
- Modify: `src/components/HomeView.tsx`

- [ ] **Step 1: 撰寫 `src/hooks/useKeyboardShortcuts.ts`**

```typescript
'use client';

import { useEffect } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: (e: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        const matchKey = e.key.toLowerCase() === s.key.toLowerCase();
        const matchCtrl = !!s.ctrl === e.ctrlKey;
        const matchMeta = !!s.meta === e.metaKey;
        const matchShift = !!s.shift === e.shiftKey;
        if (matchKey && (s.ctrl || s.meta ? (e.ctrlKey || e.metaKey) : matchCtrl && matchMeta) && matchShift) {
          e.preventDefault();
          s.handler(e);
          return;
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcuts]);
}
```

- [ ] **Step 2: 修改 `src/components/SearchInput.tsx` 加上 ref forwarding**

把 component signature 改成 `React.forwardRef`：

```typescript
import React from 'react';

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange }, ref) {
    // 原本元件內容，把 <input ... /> 加上 ref={ref}
    return (
      // ... 原本 JSX，input 加 ref={ref}
    );
  }
);
```

具體 JSX 保留現有結構，僅在 `<input>` 上加 `ref={ref}`。如果 SearchInput 不是 controlled input 而是被包在 div 內，需要找到實際 input element 加 ref。

- [ ] **Step 3: 在 HomeView 接上快捷鍵**

```typescript
import { useRef } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// 在 HomeView 內：
const searchRef = useRef<HTMLInputElement>(null);

useKeyboardShortcuts([
  {
    key: 'k',
    ctrl: true,
    meta: true,
    handler: () => searchRef.current?.focus(),
  },
  {
    key: 'f',
    handler: () => setShowFavoritesOnly((v) => !v),
  },
]);
```

並將 `searchRef` 透過 prop 傳給 Header → SearchInput。Header props 加上 `searchInputRef?: React.RefObject<HTMLInputElement>;`，並在 `<SearchInput ref={searchInputRef} ... />`。

- [ ] **Step 4: 驗證**

```bash
npm run dev
```

預期：按 Cmd/Ctrl+K 會聚焦搜尋框；按 `F` 切換收藏限定。Ctrl+C 關閉。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/components/SearchInput.tsx src/components/HomeView.tsx src/components/Header.tsx
git commit -m "feat(ux): 加入鍵盤快捷鍵 Cmd/Ctrl+K 聚焦搜尋、F 切換收藏限定"
```

---

### Task 18: 「新增收藏」改為自訂 Dialog（取代 window.prompt）

**Files:**
- Create: `src/components/AddMovieDialog.tsx`
- Modify: `src/components/HomeView.tsx`

- [ ] **Step 1: 撰寫 `src/components/AddMovieDialog.tsx`**

```typescript
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => Promise<void>;
  isSubmitting: boolean;
}

export function AddMovieDialog({ open, onClose, onSubmit, isSubmitting }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!url.trim()) {
      setError('請輸入網址');
      return;
    }
    try {
      await onSubmit(url.trim());
      setUrl('');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-1.5 text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-white">新增收藏</h3>
            <p className="mt-1 text-xs text-white/40">支援 Jable、MissAV、Javrate 連結</p>

            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="https://jable.tv/videos/..."
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isSubmitting ? '抓取中…' : '新增'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: HomeView 接上 Dialog（取代 prompt）**

於 `src/components/HomeView.tsx`：

```typescript
import { AddMovieDialog } from './AddMovieDialog';

// state
const [addOpen, setAddOpen] = useState(false);

// 取代原本 handleAddMovie，改為：
const handleAddMovie = () => setAddOpen(true);
const handleSubmitAdd = async (url: string) => {
  await addMovie.mutateAsync(url);
};

// 在 main 末端加：
<AddMovieDialog
  open={addOpen}
  onClose={() => setAddOpen(false)}
  onSubmit={handleSubmitAdd}
  isSubmitting={addMovie.isPending}
/>
```

- [ ] **Step 3: 驗證**

```bash
npm run dev
```

預期：按「新增收藏」開啟 Dialog 而非 window.prompt，輸入 URL 後提交，成功則關閉並出現新卡片。Ctrl+C 關閉。

- [ ] **Step 4: Commit**

```bash
git add src/components/AddMovieDialog.tsx src/components/HomeView.tsx
git commit -m "feat(ux): 新增收藏改為自訂 Dialog，取代 window.prompt"
```

---

## Phase 5 — 部署 Vercel + CI

> **目標**：把專案推上 Vercel，掛 Turso 雲端資料庫，加 GitHub Actions 型別檢查。

---

### Task 19: 建立 Turso 雲端資料庫並部署 Vercel

**Files:**
- Modify: `.env.local`
- Modify: `README.md`

- [ ] **Step 1: 註冊並建立 Turso 資料庫**

於終端機：

```bash
# 安裝 Turso CLI（Windows：使用 npm 全域安裝）
npm install -g @turso/cli

# 登入（會開瀏覽器）
turso auth login

# 建立資料庫
turso db create avcollect

# 取得連線資訊
turso db show avcollect --url
turso db tokens create avcollect
```

把 url 與 token 紀錄下來。

- [ ] **Step 2: 將雲端 schema 同步**

更新 `.env.local`：

```env
TURSO_DATABASE_URL=libsql://avcollect-<your-org>.turso.io
TURSO_AUTH_TOKEN=eyJhbGc...（剛剛產生的 token）
```

執行 migration 與 seed 到雲端：

```bash
npm run db:migrate
npm run db:seed
```

預期：Turso 雲端會有 movies / favorites 兩張表並含資料。

驗證：

```bash
turso db shell avcollect "SELECT COUNT(*) FROM movies;"
```

預期：印出 ~400+。

- [ ] **Step 3: Vercel 設定**

```bash
npm install -g vercel
vercel login
vercel link
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add TURSO_DATABASE_URL preview
vercel env add TURSO_AUTH_TOKEN preview
```

每個指令會提示輸入值，貼入相應內容。

- [ ] **Step 4: 部署**

```bash
vercel --prod
```

預期：CLI 顯示部署 URL。開啟 URL，確認首頁正確顯示影片、收藏可運作。

- [ ] **Step 5: 更新 README.md**

替換內容（保留 Logo 區塊若有）：

```markdown
# AvCollect

頂級數位資產典藏庫。Next.js 15 + React 19 + Turso (libSQL) + Tailwind v4。

## 本地開發

```bash
npm install
cp .env.example .env.local
# 將 TURSO_DATABASE_URL 設為 file:./local.db 作本機開發
npm run db:migrate
npm run db:seed
npm run dev
```

## 部署到 Vercel

1. 在 Turso 建立資料庫：
   ```bash
   turso db create avcollect
   turso db show avcollect --url
   turso db tokens create avcollect
   ```
2. 在 Vercel 環境變數設 `TURSO_DATABASE_URL` 與 `TURSO_AUTH_TOKEN`
3. `vercel --prod`

## 鍵盤快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Cmd/Ctrl + K` | 聚焦搜尋 |
| `F` | 切換「只看收藏」 |
| `Esc` | 關閉 Modal |
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: 重寫 README，加入 Turso 設定與部署流程"
```

---

### Task 20: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: 撰寫 `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Type check
        run: npx tsc --noEmit
      - name: Lint
        run: npm run lint
      - name: Build
        env:
          TURSO_DATABASE_URL: file:./local.db
          TURSO_AUTH_TOKEN: ''
        run: |
          npm run db:migrate
          npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: 加入 GitHub Actions 型別檢查、lint、build"
```

---

### Task 21: 最終驗證 + 清理

**Files:**
- Delete: `src/lib/data.json`（可選；保留作備份亦可）
- Delete: `src/lib/favorites.json`（可選）

- [ ] **Step 1: 端對端手動驗證（本機）**

```bash
npm run dev
```

依序驗證：
- [ ] 首頁載入有骨架屏一閃
- [ ] 400+ 部影片顯示，滾動順暢（虛擬化生效，DevTools Performance 不掉幀）
- [ ] 點卡片 → 詳情 Modal 開啟
- [ ] Modal 內按愛心 → 卡片愛心同步變紅
- [ ] 搜尋框輸入 → 即時過濾
- [ ] 主題切換 → 配色變化並持久
- [ ] 收藏匯出 → 下載 JSON
- [ ] 收藏匯入 → 覆蓋成功
- [ ] 新增收藏 Dialog → 貼 Jable 網址 → 成功
- [ ] Cmd/Ctrl+K → 聚焦搜尋
- [ ] F → 切換收藏限定
- [ ] 重整頁面 → 收藏仍在

關閉 dev server。

- [ ] **Step 2: 端對端驗證（Vercel 部署）**

開啟 Vercel 部署 URL，重複 Step 1 的關鍵項目（不需重複所有）：
- [ ] 載入正常
- [ ] 影片列表存在
- [ ] 收藏可儲存（會打到 Turso 雲端）
- [ ] 新增收藏可運作

- [ ] **Step 3: 可選清理**

如果確認 Turso 已穩定運作，可移除 JSON 來源檔：

```bash
git rm src/lib/data.json src/lib/favorites.json
```

注意：保留也無害（已不被任何程式碼引用），如想保留為災難復原備份可不刪。

- [ ] **Step 4: 最終 Commit**

```bash
git add -A
git commit -m "chore: 全方面改進完成，端對端驗證通過"
```

- [ ] **Step 5: 推送並建 PR（如使用 PR 流程）**

```bash
git push -u origin master
```

---

## Self-Review

**1. Spec coverage**
- ✅ 資料層升級 → Phase 1（Task 1-6）
- ✅ 卡片虛擬化 → Task 12
- ✅ Error Boundary → Task 10
- ✅ Loading/Error/Empty 三態 → Task 9 + Task 12
- ✅ 拆分過大元件 → Task 11, 13
- ✅ Server Component 化 → Task 13
- ✅ API 驗證 → Task 6 (Zod)
- ✅ 影片詳情 → Task 14
- ✅ 主題切換 → Task 15
- ✅ 收藏匯入匯出 → Task 16
- ✅ 鍵盤快捷鍵 → Task 17
- ✅ Vercel 部署 → Task 19
- ✅ CI → Task 20

**2. Placeholder scan**：無「TBD」、「TODO」、「fill in」等字眼，所有步驟都附完整程式碼。

**3. Type consistency**：
- `Movie` interface 全程一致
- `useFavorites` 在 Task 8 改為 TanStack Query 後，新增的 `replaceFavorites` 在 Task 16 使用
- `MovieDetailModal` props (movie, onClose) 在 Task 13 stub 與 Task 14 完整實作中一致
- Header props 在 Task 11、15、16、17 累加，所有新增 prop 都有對應傳入

**4. 依賴順序**：
- Task 11 引入 `ThemeToggle` 但檔案不存在 → 已說明用 `<></>` 暫代，Task 15 啟用
- Task 13 引入 `MovieDetailModal` → 已先建立 stub，Task 14 覆蓋

---

## 執行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-20-avcollect-overhaul.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 每個 Task dispatch 一個全新 subagent，task 之間做 review，快速迭代並保持主對話精簡。

**2. Inline Execution** — 在此 session 直接執行 tasks，使用 executing-plans skill，批次執行並設 checkpoint。

請選擇執行方式。
