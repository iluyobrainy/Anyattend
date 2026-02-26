import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.DATABASE_URL
});

export async function runMigrations(): Promise<void> {
  const sqlPath = path.resolve(process.cwd(), "sql/init.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await pool.query(sql);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
