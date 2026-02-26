import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db.js";
import { requireAdmin, type AdminRequest } from "../middleware/adminAuth.js";
import type { CommandType } from "../types/index.js";
import { createNonce, signCommand } from "../services/commandSigningService.js";
import { redis } from "../redis.js";
import { config } from "../config.js";

const pairingSchema = z.object({
  device_label: z.string().min(3).max(64)
});

const actionSchema = z.object({
  action: z.enum([
    "RUN_VALIDATION",
    "RESTART_ANYDESK_SERVICE",
    "LOCK_REMOTE",
    "UNLOCK_REMOTE",
    "REFRESH_STATUS"
  ]),
  payload: z.record(z.unknown()).optional().default({}),
  ttl_seconds: z.number().int().min(30).max(3600).optional().default(300)
});

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

export function createAdminRoutes(): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get("/devices", async (_req, res) => {
    const result = await pool.query(
      `SELECT id, label, host, status, last_seen, poll_interval_sec, service_name, created_at, paired_at
       FROM devices
       ORDER BY created_at DESC`
    );

    res.json({ devices: result.rows });
  });

  router.get("/devices/:id", async (req, res) => {
    const result = await pool.query(
      `SELECT id, label, host, status, last_seen, poll_interval_sec, service_name, webhook_fallback_url, created_at, paired_at
       FROM devices
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rowCount !== 1) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const commandResult = await pool.query(
      `SELECT id, type, status, issued_at, acked_at, ack_status, ack_message
       FROM commands
       WHERE device_id = $1
       ORDER BY issued_at DESC
       LIMIT 20`,
      [req.params.id]
    );

    res.json({
      device: result.rows[0],
      recent_commands: commandResult.rows
    });
  });

  router.get("/devices/:id/events", async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? "50"), 200);
    const result = await pool.query(
      `SELECT id, event_type, payload, created_at
       FROM device_events
       WHERE device_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.params.id, limit]
    );

    res.json({ events: result.rows });
  });

  router.post("/devices/:id/actions", async (req: AdminRequest, res) => {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success || !req.admin) {
      res.status(400).json({ error: "Invalid action payload", details: parsed.error?.flatten() });
      return;
    }

    const deviceId = String(req.params.id);
    const deviceResult = await pool.query(`SELECT id FROM devices WHERE id = $1`, [deviceId]);
    if (deviceResult.rowCount !== 1) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const commandId = uuidv4();
    const nonce = createNonce();
    const expiresAt = new Date(Date.now() + parsed.data.ttl_seconds * 1000).toISOString();

    const signature = signCommand({
      id: commandId,
      deviceId,
      type: parsed.data.action as CommandType,
      payload: parsed.data.payload,
      nonce,
      expiresAt
    });

    await pool.query(
      `INSERT INTO commands (id, device_id, type, payload, status, issued_by, expires_at, nonce, signature)
       VALUES ($1, $2, $3, $4::jsonb, 'pending', $5, $6, $7, $8)`,
      [commandId, deviceId, parsed.data.action, JSON.stringify(parsed.data.payload), req.admin.id, expiresAt, nonce, signature]
    );

    if (redis.status === "ready") {
      const event = JSON.stringify({ command_id: commandId, device_id: deviceId });
      await redis.lpush(`commands:${deviceId}`, event);
    }

    await pool.query(
      `INSERT INTO device_events (device_id, event_type, payload)
       VALUES ($1, 'admin_action', $2::jsonb)`,
      [deviceId, JSON.stringify({ action: parsed.data.action, issued_by: req.admin.email })]
    );

    res.status(202).json({
      command: {
        id: commandId,
        device_id: deviceId,
        type: parsed.data.action,
        payload: parsed.data.payload,
        nonce,
        expires_at: expiresAt,
        signature
      }
    });
  });

  router.post("/devices/pairing/start", async (req: AdminRequest, res) => {
    const parsed = pairingSchema.safeParse(req.body);
    if (!parsed.success || !req.admin) {
      res.status(400).json({ error: "Invalid pairing request", details: parsed.error?.flatten() });
      return;
    }

    const pairingCode = randomNumericCode(6);
    const pairingSessionId = uuidv4();
    const expiresAt = new Date(Date.now() + config.PAIRING_SESSION_TTL_MIN * 60 * 1000);

    await pool.query(
      `INSERT INTO pairing_sessions (id, admin_id, device_label, pairing_code_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [pairingSessionId, req.admin.id, parsed.data.device_label, sha256(pairingCode), expiresAt]
    );

    res.status(201).json({
      pairing_session_id: pairingSessionId,
      pairing_code: pairingCode,
      expires_at: expiresAt.toISOString(),
      qr_payload: JSON.stringify({
        pairing_session_id: pairingSessionId,
        pairing_code: pairingCode
      })
    });
  });

  return router;
}
