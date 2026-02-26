import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireDevice, type DeviceRequest } from "../middleware/deviceAuth.js";
import { createDeviceToken, hashDeviceToken } from "../services/deviceAuthService.js";
import { config } from "../config.js";
import { sendPushToAdmin } from "../services/pushService.js";

const pairingCompleteSchema = z.object({
  pairing_session_id: z.string().uuid(),
  pairing_code: z.string().regex(/^\d{6}$/),
  host: z.string().min(1).max(128).optional(),
  poll_interval_sec: z.number().int().min(10).max(300).optional().default(60),
  service_name: z.string().min(1).max(128).optional().default("AnyDesk"),
  webhook_fallback_url: z.string().url().nullable().optional().default(null)
});

const heartbeatSchema = z.object({
  host: z.string().min(1).max(128),
  status: z.enum(["online", "offline", "degraded", "critical"]),
  details: z.record(z.unknown()).optional().default({})
});

const alertSchema = z.object({
  host: z.string().min(1).max(128),
  timestamp: z.string().datetime(),
  status: z.string().min(1),
  action_taken: z.string().min(1),
  details: z.record(z.unknown()).optional().default({})
});

const ackSchema = z.object({
  ack_status: z.enum(["success", "failed"]),
  ack_message: z.string().max(400).optional().default("")
});

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createDeviceRoutes(): Router {
  const router = Router();

  router.post("/pair/complete", async (req, res) => {
    const parsed = pairingCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid pairing request", details: parsed.error.flatten() });
      return;
    }

    const sessionResult = await pool.query(
      `SELECT id, admin_id, device_label, pairing_code_hash, expires_at, used_at
       FROM pairing_sessions
       WHERE id = $1`,
      [parsed.data.pairing_session_id]
    );

    if (sessionResult.rowCount !== 1) {
      res.status(404).json({ error: "Pairing session not found" });
      return;
    }

    const session = sessionResult.rows[0];
    if (session.used_at) {
      res.status(409).json({ error: "Pairing session already used" });
      return;
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      res.status(410).json({ error: "Pairing session expired" });
      return;
    }

    if (sha256(parsed.data.pairing_code) !== session.pairing_code_hash) {
      res.status(401).json({ error: "Invalid pairing code" });
      return;
    }

    const token = createDeviceToken(config.DEVICE_TOKEN_BYTES);
    const tokenHash = hashDeviceToken(token);

    const deviceInsert = await pool.query(
      `INSERT INTO devices (owner_admin_id, label, host, status, last_seen, poll_interval_sec, service_name, webhook_fallback_url, api_token_hash, paired_at)
       VALUES ($1, $2, $3, 'online', NOW(), $4, $5, $6, $7, NOW())
       RETURNING id, label, poll_interval_sec, service_name, webhook_fallback_url`,
      [session.admin_id, session.device_label, parsed.data.host ?? null, parsed.data.poll_interval_sec, parsed.data.service_name, parsed.data.webhook_fallback_url, tokenHash]
    );

    await pool.query(`UPDATE pairing_sessions SET used_at = NOW() WHERE id = $1`, [session.id]);

    const device = deviceInsert.rows[0];

    await pool.query(
      `INSERT INTO device_events (device_id, event_type, payload)
       VALUES ($1, 'pairing_complete', $2::jsonb)`,
      [device.id, JSON.stringify({ host: parsed.data.host ?? null })]
    );

    await sendPushToAdmin(session.admin_id, {
      title: "Device Paired",
      body: `${device.label} is now connected`,
      device_id: device.id,
      event_type: "pairing_complete"
    });

    res.status(201).json({
      device_id: device.id,
      device_token: token,
      poll_interval_sec: device.poll_interval_sec,
      service_name: device.service_name,
      webhook_fallback_url: device.webhook_fallback_url
    });
  });

  router.use(requireDevice);

  router.post("/heartbeat", async (req: DeviceRequest, res) => {
    const parsed = heartbeatSchema.safeParse(req.body);
    if (!parsed.success || !req.device) {
      res.status(400).json({ error: "Invalid heartbeat payload", details: parsed.error?.flatten() });
      return;
    }

    await pool.query(
      `UPDATE devices
       SET host = $1, status = $2, last_seen = NOW()
       WHERE id = $3`,
      [parsed.data.host, parsed.data.status, req.device.id]
    );

    await pool.query(
      `INSERT INTO device_events (device_id, event_type, payload)
       VALUES ($1, 'heartbeat', $2::jsonb)`,
      [req.device.id, JSON.stringify(parsed.data)]
    );

    res.status(204).send();
  });

  router.post("/alerts", async (req: DeviceRequest, res) => {
    const parsed = alertSchema.safeParse(req.body);
    if (!parsed.success || !req.device) {
      res.status(400).json({ error: "Invalid alert payload", details: parsed.error?.flatten() });
      return;
    }

    await pool.query(
      `UPDATE devices
       SET host = $1, status = CASE WHEN $2 = 'healthy' THEN 'online' ELSE 'critical' END, last_seen = NOW()
       WHERE id = $3`,
      [parsed.data.host, parsed.data.status, req.device.id]
    );

    await pool.query(
      `INSERT INTO device_events (device_id, event_type, payload)
       VALUES ($1, 'alert', $2::jsonb)`,
      [req.device.id, JSON.stringify(parsed.data)]
    );

    const ownerResult = await pool.query(`SELECT owner_admin_id, label FROM devices WHERE id = $1`, [req.device.id]);
    const ownerAdminId = ownerResult.rows[0]?.owner_admin_id as string | undefined;
    const label = ownerResult.rows[0]?.label as string | undefined;

    if (ownerAdminId) {
      await sendPushToAdmin(ownerAdminId, {
        title: "Anyattend Alert",
        body: `${label ?? req.device.label}: ${parsed.data.action_taken}`,
        device_id: req.device.id,
        event_type: "alert",
        status: parsed.data.status
      });
    }

    res.status(202).json({ received: true });
  });

  router.get("/commands", async (req: DeviceRequest, res) => {
    if (!req.device) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const sinceRaw = String(req.query.since ?? "").trim();
    const sinceDate = sinceRaw ? new Date(sinceRaw) : null;

    const result = await pool.query(
      `SELECT id, type, payload, nonce, signature, expires_at
       FROM commands
       WHERE device_id = $1
         AND status IN ('pending', 'dispatched')
         AND expires_at > NOW()
         AND ($2::timestamptz IS NULL OR issued_at > $2::timestamptz)
       ORDER BY issued_at ASC
       LIMIT 100`,
      [req.device.id, sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate.toISOString() : null]
    );

    if (result.rowCount && result.rowCount > 0) {
      await pool.query(
        `UPDATE commands
         SET status = 'dispatched'
         WHERE id = ANY($1::uuid[])`,
        [result.rows.map((row) => row.id)]
      );
    }

    res.json({
      commands: result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        payload: row.payload,
        nonce: row.nonce,
        expires_at: row.expires_at,
        signature: row.signature
      }))
    });
  });

  router.post("/commands/:id/ack", async (req: DeviceRequest, res) => {
    if (!req.device) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = ackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ack payload", details: parsed.error.flatten() });
      return;
    }

    const result = await pool.query(
      `UPDATE commands
       SET status = CASE WHEN $1 = 'success' THEN 'acked' ELSE 'failed' END,
           acked_at = NOW(),
           ack_status = $1,
           ack_message = $2
       WHERE id = $3
         AND device_id = $4
       RETURNING id, type`,
      [parsed.data.ack_status, parsed.data.ack_message, req.params.id, req.device.id]
    );

    if (result.rowCount !== 1) {
      res.status(404).json({ error: "Command not found" });
      return;
    }

    await pool.query(
      `INSERT INTO device_events (device_id, event_type, payload)
       VALUES ($1, 'command_ack', $2::jsonb)`,
      [req.device.id, JSON.stringify({ command_id: req.params.id, ...parsed.data })]
    );

    const ownerResult = await pool.query(`SELECT owner_admin_id, label FROM devices WHERE id = $1`, [req.device.id]);
    const ownerAdminId = ownerResult.rows[0]?.owner_admin_id as string | undefined;
    const label = ownerResult.rows[0]?.label as string | undefined;

    if (ownerAdminId) {
      await sendPushToAdmin(ownerAdminId, {
        title: "Command Acknowledged",
        body: `${label ?? req.device.label}: ${result.rows[0].type} ${parsed.data.ack_status}`,
        device_id: req.device.id,
        event_type: "command_ack"
      });
    }

    res.status(204).send();
  });

  return router;
}
