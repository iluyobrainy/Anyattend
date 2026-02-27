import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { config } from "../config.js";
import { normalizeAnyDeskId } from "./anydeskIdService.js";
import { signAccessToken } from "./authService.js";

interface IdentityRow {
  id: string;
  normalized_anydesk_id: string;
  display_anydesk_id: string;
  verified_at: string | null;
  active_role: "admin" | "connectee";
  legacy_admin_id: string | null;
}

interface LegacyAdmin {
  id: string;
  email: string;
}

interface SessionTokens {
  access_token: string;
  refresh_token: string;
  admin: {
    id: string;
    identity_id: string;
    anydesk_id: string;
    role: "admin";
    active_role: "admin" | "connectee";
  };
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomNumericCode(length: number): string {
  const digits = "0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += digits[Math.floor(Math.random() * digits.length)];
  }
  return out;
}

function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

async function getIdentityByChallenge(challengeId: string): Promise<{
  challengeId: string;
  identity: IdentityRow;
  challenge_code_hash: string;
  expires_at: string;
  consumed_at: string | null;
} | null> {
  const result = await pool.query(
    `SELECT c.id AS challenge_id, c.challenge_code_hash, c.expires_at, c.consumed_at,
            i.id, i.normalized_anydesk_id, i.display_anydesk_id, i.verified_at, i.active_role, i.legacy_admin_id
     FROM ownership_challenges c
     JOIN identities i ON i.id = c.identity_id
     WHERE c.id = $1
     LIMIT 1`,
    [challengeId]
  );

  if (result.rowCount !== 1) {
    return null;
  }

  const row = result.rows[0];
  return {
    challengeId: row.challenge_id,
    challenge_code_hash: row.challenge_code_hash,
    expires_at: row.expires_at,
    consumed_at: row.consumed_at,
    identity: {
      id: row.id,
      normalized_anydesk_id: row.normalized_anydesk_id,
      display_anydesk_id: row.display_anydesk_id,
      verified_at: row.verified_at,
      active_role: row.active_role,
      legacy_admin_id: row.legacy_admin_id
    }
  };
}

async function ensureIdentityRoles(identityId: string): Promise<void> {
  await pool.query(
    `INSERT INTO identity_roles (identity_id, role)
     VALUES ($1, 'connectee')
     ON CONFLICT (identity_id, role) DO NOTHING`,
    [identityId]
  );

  await pool.query(
    `INSERT INTO identity_roles (identity_id, role)
     VALUES ($1, 'admin')
     ON CONFLICT (identity_id, role) DO NOTHING`,
    [identityId]
  );
}

async function getLegacyAdmin(identity: IdentityRow): Promise<LegacyAdmin> {
  if (identity.legacy_admin_id) {
    const existing = await pool.query(`SELECT id, email FROM admins WHERE id = $1 LIMIT 1`, [identity.legacy_admin_id]);
    if (existing.rowCount === 1) {
      return existing.rows[0] as LegacyAdmin;
    }
  }

  const syntheticEmail = `id-${identity.normalized_anydesk_id}@anyattend.local`;
  const existingByEmail = await pool.query(`SELECT id, email FROM admins WHERE email = $1 LIMIT 1`, [syntheticEmail]);
  if (existingByEmail.rowCount === 1) {
    const legacy = existingByEmail.rows[0] as LegacyAdmin;
    await pool.query(`UPDATE identities SET legacy_admin_id = $1, updated_at = NOW() WHERE id = $2`, [legacy.id, identity.id]);
    return legacy;
  }

  const passwordHash = await bcrypt.hash(randomToken(24), 10);
  const inserted = await pool.query(
    `INSERT INTO admins (email, password_hash, totp_secret, is_active)
     VALUES ($1, $2, $3, FALSE)
     RETURNING id, email`,
    [syntheticEmail, passwordHash, "LEGACY_DISABLED"]
  );

  const legacy = inserted.rows[0] as LegacyAdmin;
  await pool.query(`UPDATE identities SET legacy_admin_id = $1, updated_at = NOW() WHERE id = $2`, [legacy.id, identity.id]);
  return legacy;
}

async function createAdminSession(identityId: string, fingerprint: string | null): Promise<string> {
  const token = randomToken(48);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO admin_sessions (identity_id, refresh_token_hash, expires_at, fingerprint)
     VALUES ($1, $2, $3, $4)`,
    [identityId, tokenHash, expiresAt, fingerprint]
  );

  return token;
}

function createAccessToken(identity: IdentityRow, legacyAdminId: string): string {
  return signAccessToken({
    sub: legacyAdminId,
    role: "admin",
    email: `id:${identity.display_anydesk_id}`,
    anydesk_id: identity.normalized_anydesk_id,
    display_anydesk_id: identity.display_anydesk_id,
    identity_id: identity.id,
    legacy_admin_id: legacyAdminId
  });
}

async function loadIdentityById(identityId: string): Promise<IdentityRow | null> {
  const result = await pool.query(
    `SELECT id, normalized_anydesk_id, display_anydesk_id, verified_at, active_role, legacy_admin_id
     FROM identities
     WHERE id = $1
     LIMIT 1`,
    [identityId]
  );
  return result.rowCount === 1 ? (result.rows[0] as IdentityRow) : null;
}

export async function startAdminChallenge(anydeskId: string): Promise<{
  challenge_id: string;
  expires_at: string;
  linked_device_id: string | null;
  delivery: { method: "paired_device_event"; note: string };
  development_verification_code?: string;
}> {
  const normalized = normalizeAnyDeskId(anydeskId);

  const identityResult = await pool.query(
    `INSERT INTO identities (normalized_anydesk_id, display_anydesk_id)
     VALUES ($1, $2)
     ON CONFLICT (normalized_anydesk_id)
     DO UPDATE SET display_anydesk_id = EXCLUDED.display_anydesk_id, updated_at = NOW()
     RETURNING id, normalized_anydesk_id, display_anydesk_id, verified_at, active_role, legacy_admin_id`,
    [normalized.normalized, normalized.display]
  );

  const identity = identityResult.rows[0] as IdentityRow;
  await ensureIdentityRoles(identity.id);

  const deviceResult = await pool.query(
    `SELECT id
     FROM devices
     WHERE owner_identity_id = $1
     ORDER BY COALESCE(last_seen, created_at) DESC
     LIMIT 1`,
    [identity.id]
  );

  const linkedDeviceId = (deviceResult.rows[0]?.id as string | undefined) ?? null;
  const verificationCode = randomNumericCode(6);
  const expiresAt = new Date(Date.now() + config.OWNERSHIP_CHALLENGE_TTL_MIN * 60 * 1000);

  const challengeInsert = await pool.query(
    `INSERT INTO ownership_challenges (identity_id, device_id, challenge_code_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [identity.id, linkedDeviceId, sha256(verificationCode), expiresAt]
  );

  if (linkedDeviceId) {
    await pool.query(
      `INSERT INTO device_events (device_id, event_type, payload)
       VALUES ($1, 'ownership_challenge_issued', $2::jsonb)`,
      [
        linkedDeviceId,
        JSON.stringify({
          challenge_id: challengeInsert.rows[0].id,
          expires_at: expiresAt.toISOString(),
          anydesk_id: identity.display_anydesk_id
        })
      ]
    );
  }

  return {
    challenge_id: challengeInsert.rows[0].id as string,
    expires_at: expiresAt.toISOString(),
    linked_device_id: linkedDeviceId,
    delivery: {
      method: "paired_device_event",
      note:
        "Verification code is issued to the paired connectee context. Use the challenge code shown by your paired setup flow."
    },
    ...(config.AUTH_CHALLENGE_DEBUG ? { development_verification_code: verificationCode } : {})
  };
}

export async function verifyAdminChallenge(challengeId: string, verificationCode: string, fingerprint: string | null): Promise<SessionTokens | null> {
  const challenge = await getIdentityByChallenge(challengeId);
  if (!challenge) {
    return null;
  }

  if (challenge.consumed_at) {
    throw new Error("Challenge already used.");
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new Error("Challenge expired.");
  }

  if (!/^\d{6}$/.test(verificationCode)) {
    throw new Error("Verification code must be a 6-digit value.");
  }

  if (sha256(verificationCode) !== challenge.challenge_code_hash) {
    await pool.query(`UPDATE ownership_challenges SET attempts = attempts + 1 WHERE id = $1`, [challengeId]);
    return null;
  }

  await pool.query(`UPDATE ownership_challenges SET consumed_at = NOW() WHERE id = $1`, [challengeId]);
  await pool.query(
    `UPDATE identities
     SET verified_at = NOW(),
         verification_method = 'ownership_challenge',
         active_role = 'admin',
         updated_at = NOW()
     WHERE id = $1`,
    [challenge.identity.id]
  );
  await ensureIdentityRoles(challenge.identity.id);

  const refreshedIdentity = await loadIdentityById(challenge.identity.id);
  if (!refreshedIdentity) {
    return null;
  }

  const legacyAdmin = await getLegacyAdmin(refreshedIdentity);
  const accessToken = createAccessToken(refreshedIdentity, legacyAdmin.id);
  const refreshToken = await createAdminSession(refreshedIdentity.id, fingerprint);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    admin: {
      id: legacyAdmin.id,
      identity_id: refreshedIdentity.id,
      anydesk_id: refreshedIdentity.display_anydesk_id,
      role: "admin",
      active_role: refreshedIdentity.active_role
    }
  };
}

export async function rotateAdminSession(refreshToken: string, fingerprint: string | null): Promise<SessionTokens | null> {
  const tokenHash = sha256(refreshToken);
  const result = await pool.query(
    `SELECT id, identity_id, expires_at, revoked_at
     FROM admin_sessions
     WHERE refresh_token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  if (result.rowCount !== 1) {
    return null;
  }

  const session = result.rows[0];
  if (session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) {
    return null;
  }

  await pool.query(`UPDATE admin_sessions SET revoked_at = NOW() WHERE id = $1`, [session.id]);

  const identity = await loadIdentityById(session.identity_id as string);
  if (!identity) {
    return null;
  }

  const legacyAdmin = await getLegacyAdmin(identity);
  const newRefreshToken = await createAdminSession(identity.id, fingerprint);
  const accessToken = createAccessToken(identity, legacyAdmin.id);

  return {
    access_token: accessToken,
    refresh_token: newRefreshToken,
    admin: {
      id: legacyAdmin.id,
      identity_id: identity.id,
      anydesk_id: identity.display_anydesk_id,
      role: "admin",
      active_role: identity.active_role
    }
  };
}

export async function logoutAdminSession(refreshToken: string): Promise<void> {
  const tokenHash = sha256(refreshToken);
  await pool.query(`UPDATE admin_sessions SET revoked_at = NOW() WHERE refresh_token_hash = $1`, [tokenHash]);
}

export async function getIdentityRoles(identityId: string): Promise<{ active_role: "admin" | "connectee"; roles: Array<"admin" | "connectee"> } | null> {
  const identity = await loadIdentityById(identityId);
  if (!identity) {
    return null;
  }

  const rolesResult = await pool.query(
    `SELECT role
     FROM identity_roles
     WHERE identity_id = $1
     ORDER BY role`,
    [identityId]
  );

  const roles = rolesResult.rows.map((row) => row.role as "admin" | "connectee");
  return {
    active_role: identity.active_role,
    roles
  };
}

export async function activateRole(identityId: string, role: "admin" | "connectee"): Promise<boolean> {
  const roleResult = await pool.query(
    `SELECT 1
     FROM identity_roles
     WHERE identity_id = $1 AND role = $2
     LIMIT 1`,
    [identityId, role]
  );

  if (roleResult.rowCount !== 1) {
    return false;
  }

  await pool.query(`UPDATE identities SET active_role = $1, updated_at = NOW() WHERE id = $2`, [role, identityId]);
  return true;
}
