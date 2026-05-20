# AvBatch ↔ AvCollect 協作架構

兩個專案透過 **Turso 雲端 SQLite** 解耦，不直接通訊。

## 資料流

```
                   ┌────────────────────────┐
                   │  Turso 雲端 SQLite     │
                   │   ┌─────────────┐      │
                   │   │  movies     │ ←─ 唯一資料源
                   │   │  favorites  │      │
                   │   └─────────────┘      │
                   └─────▲────▲─────────────┘
                         │    │
              ┌──────────┘    └──────────┐
              │ INSERT                   │ SELECT (SSR)
              │                          │
    ┌─────────┴────────┐         ┌──────┴────────────┐
    │   AvBatch        │         │   AvCollect       │
    │   (爬蟲後台)     │         │   (前台 UI)       │
    │                  │         │                   │
    │ GitHub Actions   │         │ Vercel            │
    │ cron 9/12/21時   │         │ avcollect.vercel  │
    │                  │         │       .app        │
    │ Discord 通知     │         │ 密碼登入後使用     │
    └──────────────────┘         └───────────────────┘
```

## 各專案職責

| 專案 | 寫 Turso | 讀 Turso | 主要產出 |
|------|:-:|:-:|---------|
| **AvBatch** | INSERT 新片 | 取已通知 codes 去重 | Discord 通知 |
| **AvCollect** | 收藏 toggle、手動新增 | Server Component SSR | UI 瀏覽介面 |

## 典型情境

### 情境 A：早上 09:00 自動發現新片
1. GitHub Actions 觸發 → AvBatch 跑
2. 爬 200+ 部，過濾後 say 30 部命中（白名單/女優/標籤）
3. Discord 通知你 + 寫入 Turso
4. 你重整 https://avcollect.vercel.app → 直接看到 30 部新片（**無需 redeploy**）

### 情境 B：你看到 Discord 通知想存某部
1. 點 Discord 卡片 → 連到外站看片
2. 登入 AvCollect → 該片已經在裡面 → 按 ♥ 收藏

### 情境 C：你發現一部 AvBatch 沒抓到的影片
1. AvCollect 點「新增收藏」→ 貼 URL
2. AvCollect 後端 Cheerio 抓 metadata → 寫入 Turso
3. 下次 AvBatch 跑 → `getAllCodes()` 看到該 code 已存在 → 不會重複通知

## 日常維護指令

```powershell
# AvBatch 立即手動跑一次（不等排程）
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
npx tsx src/index.ts --run-once

# 改 AvBatch filter 設定（preferredIssuers / preferredActresses）
# → 編輯 src/config.ts → git commit → git push
# → 下次 GH Actions 自動用新 config

# AvCollect 改 UI / 加功能
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
git checkout -b feat/your-feature
# 改完
git commit -am "..." && git push
# → Vercel 自動建 preview deployment
# 滿意後
git checkout master && git merge feat/your-feature && git push
# → Vercel 自動 production deploy

# 看 Turso 雲端目前有幾部
node -e "require('dotenv').config(); const{createClient}=require('@libsql/client'); const c=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN}); c.execute('SELECT COUNT(*) as n FROM movies').then(r=>console.log(r.rows[0].n))"

# 查最近 10 部新加的
node -e "require('dotenv').config(); const{createClient}=require('@libsql/client'); const c=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN}); c.execute('SELECT code,title FROM movies ORDER BY created_at DESC LIMIT 10').then(r=>r.rows.forEach(x=>console.log(x.code,'-',x.title.slice(0,40))))"
```

## 反模式 — 不要這樣做

| ❌ 不要 | ✅ 改用 |
|--------|--------|
| 手動 commit `notified.json` / `gallery.json` 進 git | Turso 自動處理（這兩檔已廢除） |
| 兩專案各自定義 Movie schema | 統一以 AvCollect 的 `src/lib/db/schema.ts` 為準 |
| 在 AvBatch 直接寫 `favorites` table | 收藏只在 AvCollect 操作 |
| AvBatch 變更 schema | 必須先在 AvCollect 跑 `npm run db:generate` + `db:migrate` |
| Token 寫死進程式碼 | 用 `process.env.TURSO_AUTH_TOKEN` |
| AvCollect API 開放 | middleware 已強制要求 cookie session |

## Schema 變更標準流程

例如想加 `release_date` 欄位：

```powershell
# 1. 在 AvCollect 改 schema
cd C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect
# 編輯 src/lib/db/schema.ts → movies table 加 releaseDate 欄位
npm run db:generate              # 產 migration SQL
npm run db:migrate               # 套用到 Turso 雲端

# 2. AvBatch 同步更新 insertMovies 也填這欄
cd C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch
# 編輯 src/services/turso.ts → INSERT 語句加 release_date
# 編輯 src/types.ts → MovieItem 加 releaseDate?: string

# 3. 兩邊各自 commit + push
```

## 環境變數對照表

| 變數 | AvCollect | AvBatch | Vercel | GitHub Actions |
|------|:-:|:-:|:-:|:-:|
| `TURSO_DATABASE_URL` | ✅ | ✅ | ✅ | ✅ |
| `TURSO_AUTH_TOKEN` | ✅ | ✅ | ✅ | ✅ |
| `APP_SECRET` | ✅ | ❌ | ✅ | ❌ |
| `DISCORD_WEBHOOK_URL` | ❌ | ✅ | ❌ | ✅ |
| `NEXT_PUBLIC_APP_URL` | ✅ | ❌ | ✅ | ❌ |

## Token Rotation 流程（每年建議一次）

```powershell
# 1. Turso Dashboard → avcollect → Tokens → Revoke 舊的，產新的

$NEW = "新token貼這裡"

# 2. 更新本地兩個專案 .env / .env.local
# AvCollect: C:\Users\c1471\Desktop\Projects\03.WebApps\AvCollect\.env.local + .env
# AvBatch: C:\Users\c1471\Desktop\Projects\02.Batch\AvBatch\.env

# 3. Vercel (兩個環境)
npx vercel env rm TURSO_AUTH_TOKEN production --yes
npx vercel env add TURSO_AUTH_TOKEN production --value $NEW --yes
npx vercel env rm TURSO_AUTH_TOKEN preview "feat/overhaul" --yes
npx vercel env add TURSO_AUTH_TOKEN preview "feat/overhaul" --value $NEW --yes

# 4. GitHub Actions
gh secret set TURSO_AUTH_TOKEN --body $NEW --repo c14712369/Batch-AvBatch

# 5. Re-deploy 讓新 token 立即生效
npx vercel deploy --prod --yes
```

## 未來擴充候選

- [x] AvCollect actress 詳情頁（同女優所有作品聚合）
- [x] 廢除 AvBatch `public/index.html` 與 `gallery.json`（被 AvCollect 取代）
- [ ] AvBatch 加更多 source（DMM、FANZA 等）
- [ ] `release_date` 欄位 + 排序
- [ ] AvBatch 改用 Drizzle ORM（schema 從 AvCollect symlink，避免漂移）
- [ ] 多使用者支援（NextAuth + per-user favorites table）
