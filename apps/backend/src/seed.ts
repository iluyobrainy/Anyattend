import bcrypt from "bcryptjs";
import { pool, runMigrations } from "./db.js";
import { config } from "./config.js";

async function seed(): Promise<void> {
  await runMigrations();
  const exists = await pool.query(`SELECT id FROM admins WHERE email = $1`, [config.BOOTSTRAP_ADMIN_EMAIL]);

  if (exists.rowCount && exists.rowCount > 0) {
    // eslint-disable-next-line no-console
    console.log("Bootstrap admin already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash(config.BOOTSTRAP_ADMIN_PASSWORD, 12);

  await pool.query(
    `INSERT INTO admins (email, password_hash, totp_secret)
     VALUES ($1, $2, $3)`,
    [config.BOOTSTRAP_ADMIN_EMAIL, passwordHash, config.BOOTSTRAP_ADMIN_TOTP_SECRET]
  );

  // eslint-disable-next-line no-console
  console.log("Bootstrap admin created.");
}

seed()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
