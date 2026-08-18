// Logical backup of every public table to a JSON file — a safety net for
// one-database deployments where pg_dump isn't at hand. Restore by hand
// (or with a small script) from the row arrays if a migration ever needs
// unwinding. Written to backups/<timestamp>.json (git-ignored).
// Run with: npm run db:backup
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { pool } from "./index";

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows: tables } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    const dump: Record<string, unknown[]> = {};
    let total = 0;
    for (const { table_name } of tables) {
      const { rows } = await client.query(`SELECT * FROM "${table_name}"`);
      dump[table_name] = rows;
      total += rows.length;
    }
    const dir = join(process.cwd(), "backups");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join(dir, `${stamp}.json`);
    writeFileSync(file, JSON.stringify(dump, null, 1));
    console.log(`backed up ${tables.length} tables (${total} rows) → ${file}`);
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error("backup failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
