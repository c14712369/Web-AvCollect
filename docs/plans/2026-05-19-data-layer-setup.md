# AvCollect Data Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the data layer for AvCollect by defining types, importing source data, and exporting it with type support.

**Architecture:** Use a central type definition for movies and a static JSON file as the data source, exported via a typed utility file in `src/lib`.

**Tech Stack:** TypeScript, Next.js.

---

### Task 1: Define Movie Interface

**Files:**
- Create: `src/types/av.ts`

**Step 1: Create `src/types/av.ts`**

```typescript
export interface Movie {
  code: string;
  title: string;
  url: string;
  imageUrl: string;
  source: string;
  category: string;
}
```

**Step 2: Commit**

```bash
git add src/types/av.ts
git commit -m "feat: define Movie interface"
```

---

### Task 2: Import Data JSON

**Files:**
- Create: `src/lib/data.json`

**Step 1: Copy source data to `src/lib/data.json`**

Copy from `C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch\gallery.json` to `C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\src\lib\data.json`.

**Step 2: Commit**

```bash
git add src/lib/data.json
git commit -m "data: import gallery.json"
```

---

### Task 3: Export Typed Data

**Files:**
- Create: `src/lib/data.ts`

**Step 1: Create `src/lib/data.ts`**

```typescript
import { Movie } from "@/types/av";
import moviesData from "./data.json";

export const movies: Movie[] = moviesData as Movie[];
```

**Step 2: Commit**

```bash
git add src/lib/data.ts
git commit -m "feat: export typed movies data"
```
