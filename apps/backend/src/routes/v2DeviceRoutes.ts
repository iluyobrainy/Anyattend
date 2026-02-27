import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { config } from "../config.js";
import { createDeviceToken, hashDeviceToken } from "../services/deviceAuthService.js";
import { normalizeAnyDeskId } from "../services/anydeskIdService.js";

const enrollSchema = z.object({
  anydesk_id: z.string().min(1),
  verification_code: z.string().regex(/^\d{6}$/),
  device_label: z.string().min(3).max(64).optional(),
  host: z.string().min(1).max(128).optional(),
  poll_interval_sec: z.number().int().min(10).max(300).optional().default(60),
  service_name: z.string().min(1).max(128).optional().default("AnyDesk"),
  webhook_fallback_url: z.string().url().nullable().optional().default(null)
});

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createV2DeviceRoutes(): Router {
  const router = Router();

  router.post("/enroll", async (req, res) => {
    const parsed = enrollSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid enrollment payload", details: parsed.error.flatten() });
      return;
    }

    let normalizedId: { normalized: string; display: string };
    try {
      normalizedId = normalizeAnyDeskId(parsed.data.anydesk_id);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid AnyDesk ID." });
      return;
    }

    const identityResult = await pool.query(
      `SELECT id, legacy_admin_id, display_anydesk_id
       FROM identities
       WHERE normalized_anydesk_id = $1
       LIMIT 1`,
      [normalizedId.normalized]
    );

    if (identityResult.rowCount !== 1) {
      res.status(404).json({ error: "AnyDesk identity not found. Start admin verification first." });
      return;
    }

    const identity = identityResult.rows[0];
    const challengeResult = await pool.query(
      `SELECT id, challenge_code_hash, expires_at, consumed_at
       FROM ownership_challenges
       WHERE identity_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [identity.id]
    );

    const matchingChallenge = challengeResult.rows.find((row) => {
      if (row.consumed_at) {
        return false;
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return false;
      }
      return row.challenge_code_hash === sha256(parsed.data.verification_code);
    });

    if (!matchingChallenge) {
      res.status(401).json({ error: "Invalid or expired ownership challenge code." });
      return;
    }

    await pool.query(`UPDATE ownership_challenges SET consumed_at = NOW() WHERE id = $1`, [matchingChallenge.id]);
    await pool.query(
      `UPDATE identities
       SET verified_at = COALESCE(verified_at, NOW()),
           verification_method = COALESCE(verification_method, 'ownership_challenge'),
           updated_at = NOW()
       WHERE id = $1`,
      [identity.id]
    );

    const token = createDeviceToken(config.DEVICE_TOKEN_BYTES);
    const tokenHash = hashDeviceToken(token);
    const deviceLabel = parsed.data.device_label?.trim() || `${identity.display_anydesk_id} Device`;

    const deviceInsert = await pool.query(
      `INSERT INTO devices (owner_admin_id, owner_identity_id, label, host, status, last_seen, poll_interval_sec, service_name, webhook_fallback_url, api_token_hash, paired_at)
       VALUES ($1, $2, $3, $4, 'online', NOW(), $5, $6, $7, $8, NOW())
       RETURNING id, label, poll_interval_sec, service_name, webhook_fallback_url`,
      [
        identity.legacy_admin_id,
        identity.id,
        deviceLabel,
        parsed.data.host ?? null,
        parsed.data.poll_interval_sec,
        parsed.data.service_name,
        parsed.data.webhook_fallback_url,
        tokenHash
      ]
    );

    await pool.query(
      `INSERT INTO device_events (device_id, event_type, payload)
       VALUES ($1, 'pairing_complete', $2::jsonb)`,
      [
        deviceInsert.rows[0].id,
        JSON.stringify({
          host: parsed.data.host ?? null,
          anydesk_id: identity.display_anydesk_id,
          source: "v2_enroll"
        })
      ]
    );

    res.status(201).json({
      device_id: deviceInsert.rows[0].id,
      device_token: token,
      poll_interval_sec: deviceInsert.rows[0].poll_interval_sec,
      service_name: deviceInsert.rows[0].service_name,
      webhook_fallback_url: deviceInsert.rows[0].webhook_fallback_url
    });
  });

  return router;
}
