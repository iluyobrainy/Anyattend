import crypto from "node:crypto";
import { pool } from "../db.js";

function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createDeviceToken(byteLength: number): string {
  return crypto.randomBytes(byteLength).toString("base64url");
}

export function hashDeviceToken(token: string): string {
  return hashToken(token);
}

export async function resolveDeviceFromToken(token: string): Promise<{ id: string; label: string } | null> {
  const tokenHash = hashDeviceToken(token);
  const result = await pool.query(
    `SELECT id, label FROM devices WHERE api_token_hash = $1 LIMIT 1`,
    [tokenHash]
  );
  if (result.rowCount !== 1) {
    return null;
  }
  return result.rows[0];
}
