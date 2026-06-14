import { config } from 'dotenv';
config({ path: '.env.local' }); config({ path: '.env' });
const { createClient } = await import('@libsql/client');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const mode = process.argv[2];
const where = `title LIKE '%Attention Required%' OR title LIKE '%Cloudflare%' OR title LIKE '%Just a moment%'`;
if (mode === 'delete') {
  const r = await db.execute(`DELETE FROM movies WHERE ${where}`);
  console.log('Deleted rows:', r.rowsAffected);
} else {
  const r = await db.execute(`SELECT code, source, title FROM movies WHERE ${where}`);
  console.log('Matched', r.rows.length, 'row(s):');
  for (const row of r.rows) console.log(' -', row.code, '|', row.source, '|', String(row.title).slice(0,40));
}
