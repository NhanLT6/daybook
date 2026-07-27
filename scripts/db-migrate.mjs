// Applies db/migrations/*.sql to the Neon database in order, once each.
//
// Usage: node scripts/db-migrate.mjs [--status]
// Reads NEON_CONNECTION_STRING from .env / .env.local / .env.development.local.

import { Client } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local', '.env.development.local']) {
  dotenv.config({ path: resolve(root, f) });
}

const url = process.env.NEON_CONNECTION_STRING;
if (!url) {
  console.error('NEON_CONNECTION_STRING is not set (checked .env, .env.local, .env.development.local)');
  process.exit(1);
}

const dir = resolve(root, 'db/migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

// The HTTP driver rejects multi-statement SQL ("cannot insert multiple commands
// into a prepared statement"), and migrations contain several statements plus
// plpgsql bodies — so use the WebSocket client, which speaks simple query.
const client = new Client(url);
await client.connect();

try {
  await client.query(`
    create table if not exists public.schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )`);

  const { rows } = await client.query('select name from public.schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  if (process.argv.includes('--status')) {
    for (const f of files) console.log(`${applied.has(f) ? 'applied' : 'PENDING'}  ${f}`);
  } else {
    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      console.log(`applying ${file}`);
      // Each migration runs in its own transaction: all of it lands, or none of it.
      await client.query('begin');
      try {
        await client.query(readFileSync(resolve(dir, file), 'utf8'));
        await client.query('insert into public.schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
      ran += 1;
    }
    console.log(ran ? `applied ${ran} migration(s)` : 'nothing to apply');
  }
} finally {
  await client.end();
}
