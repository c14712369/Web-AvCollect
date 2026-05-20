# AvCollect Scaffolding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold a modern Next.js 15 project for 'AvCollect' with Tailwind v4 and professional UI setup.

**Architecture:** Next.js App Router (v15) with Tailwind v4 (CSS-first configuration). Standard layout with a clean, minimalist design language.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, TypeScript, Lucide React, Framer Motion, clsx, tailwind-merge.

---

### Task 1: Project Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`

**Step 1: Create package.json**
Include dependencies: `next`, `react`, `react-dom`, `tailwindcss`, `lucide-react`, `framer-motion`, `clsx`, `tailwind-merge`.
DevDependencies: `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `postcss`, `autoprefixer`.

**Step 2: Create tsconfig.json**
Standard Next.js 15 TypeScript configuration.

**Step 3: Create next.config.ts**
Standard Next.js 15 config (TypeScript version).

**Step 4: Commit**
`git add package.json tsconfig.json next.config.ts; git commit -m "chore: initial project configuration"`

---

### Task 2: Tailwind v4 Global Styles

**Files:**
- Create: `src/app/globals.css`

**Step 1: Set up globals.css with Tailwind v4**
Use `@import "tailwindcss";` and define theme variables using `@theme`.
Include base styles for a modern dark-mode aesthetic.

**Step 2: Commit**
`git add src/app/globals.css; git commit -m "feat: setup tailwind v4 and global styles"`

---

### Task 3: Root Layout and Basic Page

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Step 1: Create RootLayout**
Standard layout with font optimization and metadata.

**Step 2: Create HomePage**
A professional "Hello World" or starter view with a hero section to verify setup.

**Step 3: Commit**
`git add src/app/layout.tsx src/app/page.tsx; git commit -m "feat: add root layout and starter page"`

---

### Task 4: Verification

**Step 1: Run build**
`npm run build` (or similar) to ensure TypeScript and Next.js are happy.
Note: Since I'm in a headless environment, I'll focus on file correctness.
