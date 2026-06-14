import { config } from 'dotenv';
config({ path: '.env.local' }); config({ path: '.env' });
const { createClient } = await import('@libsql/client');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const r = await db.execute("SELECT code, title, tags FROM movies WHERE code='MIDA-673' OR title LIKE '%九野雛乃%' OR url LIKE '%7b5ba258%'");
for (const row of r.rows) console.log(JSON.stringify({code:row.code, title:row.title, tags:row.tags}, null, 0));
