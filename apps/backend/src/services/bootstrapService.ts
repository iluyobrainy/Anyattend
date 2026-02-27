import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { config } from "../config.js";

export async function ensureBootstrapAdmin(): Promise<void> {
  if (!config.ENABLE_LEGACY_AUTH && config.AUTH_MODE === "ANYDESK_ID_CHALLENGE") {
    return;
  }

  const result = await pool.query(`SELECT id FROM admins WHERE email = $1`, [config.BOOTSTRAP_ADMIN_EMAIL]);
  if (result.rowCount && result.rowCount > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(config.BOOTSTRAP_ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO admins (email, password_hash, totp_secret)
     VALUES ($1, $2, $3)`,
    [config.BOOTSTRAP_ADMIN_EMAIL, passwordHash, config.BOOTSTRAP_ADMIN_TOTP_SECRET]
  );
}
