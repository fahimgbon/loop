import "./loadEnv";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import pg from "pg";

import { getEnv } from "@/src/server/env";

type MigrationRow = { name: string };

async function main() {
  const env = getEnv();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const migrationsDir = path.join(process.cwd(), "db", "migrations");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    const applied = await client.query<MigrationRow>(`select name from schema_migrations;`);
    const appliedSet = new Set(applied.rows.map((r) => r.name));

    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const fullPath = path.join(migrationsDir, file);
      const sql = await readFile(fullPath, "utf8");
      process.stdout.write(`Applying ${file}... `);
      await client.query("begin;");
      try {
        await client.query(sql);
        await client.query(`insert into schema_migrations (name) values ($1);`, [file]);
        await client.query("commit;");
        process.stdout.write("done\n");
      } catch (err) {
        await client.query("rollback;");
        process.stdout.write("failed\n");
        throw err;
      }
    }

    process.stdout.write("Migrations complete.\n");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
