import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { pool } from "../db.js";
import { config } from "../config.js";
import type { JwtClaims } from "../types/index.js";

function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function signAccessToken(claims: JwtClaims): string {
  return jwt.sign(claims, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): JwtClaims {
  return jwt.verify(token, config.JWT_SECRET) as JwtClaims;
}

export async function createRefreshToken(adminId: string): Promise<string> {
  const plain = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashToken(plain);
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (admin_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [adminId, tokenHash, expiresAt]
  );

  return plain;
}

export async function rotateRefreshToken(token: string): Promise<{ adminId: string; newToken: string } | null> {
  const tokenHash = hashToken(token);
  const result = await pool.query(
    `SELECT id, admin_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`,
    [tokenHash]
  );

  if (result.rowCount !== 1) {
    return null;
  }

  const row = result.rows[0];
  if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }

  await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);
  const newToken = await createRefreshToken(row.admin_id);
  return { adminId: row.admin_id, newToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
}

export async function verifyAdminCredentials(email: string, password: string, totpCode: string): Promise<{ id: string; email: string } | null> {
  const result = await pool.query(
    `SELECT id, email, password_hash, totp_secret, is_active FROM admins WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (result.rowCount !== 1) {
    return null;
  }

  const admin = result.rows[0];
  if (!admin.is_active) {
    return null;
  }

  const validPassword = await bcrypt.compare(password, admin.password_hash);
  if (!validPassword) {
    return null;
  }

  const verified = speakeasy.totp.verify({
    secret: admin.totp_secret,
    encoding: "base32",
    token: totpCode,
    window: config.TOTP_WINDOW
  });

  if (!verified) {
    return null;
  }

  return { id: admin.id, email: admin.email };
}

export async function getAdminById(adminId: string): Promise<{ id: string; email: string } | null> {
  const result = await pool.query(`SELECT id, email FROM admins WHERE id = $1 LIMIT 1`, [adminId]);
  if (result.rowCount !== 1) {
    return null;
  }
  return result.rows[0];
}
