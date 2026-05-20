import 'dotenv/config';
import type { Config } from 'drizzle-kit';

const dbCredentials = process.env.TURSO_AUTH_TOKEN
  ? {
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }
  : {
      url: process.env.TURSO_DATABASE_URL!,
      authToken: undefined,
    };

const config: Config = {
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: dbCredentials as any,
};

export default config;
