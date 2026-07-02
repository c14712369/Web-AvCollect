import 'dotenv/config';
import type { Config } from 'drizzle-kit';

// 本地 file: URL（如 CI 的 file:./local.db）不需要 authToken；
// 傳空字串會被 drizzle-kit 的 turso dialect 驗證擋下，故僅遠端連線時帶上。
const url = process.env.TURSO_DATABASE_URL!;
const isLocalFile = url.startsWith('file:');

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: isLocalFile
    ? { url }
    : { url, authToken: process.env.TURSO_AUTH_TOKEN },
} satisfies Config;
