import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, type AdminRequest } from "../middleware/adminAuth.js";
import { config } from "../config.js";
import { normalizeAnyDeskId } from "../services/anydeskIdService.js";
import { sendPushToAdmin } from "../services/pushService.js";

const submitRequestSchema = z.object({
  owner_anydesk_id: z.string().min(1),
  requester_anydesk_id: z.string().min(1),
  requester_label: z.string().max(80).optional().default(""),
  note: z.string().max(240).optional().default("")
});

const decisionSchema = z.object({
  decision: z.enum(["approve", "decline"]),
  decision_note: z.string().max(240).optional().default("")
});

function requireIdentity(req: AdminRequest): string | null {
  return req.admin?.identityId ?? null;
}

async function emitAclSyncEvent(ownerIdentityId: string, requestedByIdentityId: string): Promise<void> {
  const entriesResult = await pool.query(
    `SELECT requester_normalized_anydesk_id, requester_display_anydesk_id, label
     FROM whitelist_entries
     WHERE owner_identity_id = $1 AND status = 'active'
     ORDER BY updated_at DESC`,
    [ownerIdentityId]
  );

  const payload = {
    entries: entriesResult.rows.map((row) => ({
      anydesk_id: row.requester_display_anydesk_id,
      normalized_anydesk_id: row.requester_normalized_anydesk_id,
      label: row.label
    }))
  };

  const syncInsert = await pool.query(
    `INSERT INTO acl_sync_events (owner_identity_id, requested_by_identity_id, request_payload, result_status, completed_at)
     VALUES ($1, $2, $3::jsonb, 'completed', NOW())
     RETURNING id`,
    [ownerIdentityId, requestedByIdentityId, JSON.stringify(payload)]
  );

  const devicesResult = await pool.query(
    `SELECT id
     FROM devices
     WHERE owner_identity_id = $1`,
    [ownerIdentityId]
  );

  await Promise.all(
    devicesResult.rows.map((row) =>
      pool.query(
        `INSERT INTO device_events (device_id, event_type, payload)
         VALUES ($1, 'acl_sync_requested', $2::jsonb)`,
        [row.id, JSON.stringify({ sync_event_id: syncInsert.rows[0].id, whitelist_size: payload.entries.length })]
      )
    )
  );
}

export function createPublicRequestRoutes(): Router {
  const router = Router();

  router.post("/requests", async (req, res) => {
    const parsed = submitRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    try {
      const ownerId = normalizeAnyDeskId(parsed.data.owner_anydesk_id);
      const requesterId = normalizeAnyDeskId(parsed.data.requester_anydesk_id);

      const ownerResult = await pool.query(
        `SELECT id, display_anydesk_id, legacy_admin_id
         FROM identities
         WHERE normalized_anydesk_id = $1
         LIMIT 1`,
        [ownerId.normalized]
      );

      if (ownerResult.rowCount !== 1) {
        res.status(404).json({ error: "Owner AnyDesk ID is not registered." });
        return;
      }

      const ownerIdentity = ownerResult.rows[0];
      const activeAllowResult = await pool.query(
        `SELECT id
         FROM whitelist_entries
         WHERE owner_identity_id = $1
           AND requester_normalized_anydesk_id = $2
           AND status = 'active'
         LIMIT 1`,
        [ownerIdentity.id, requesterId.normalized]
      );

      if (activeAllowResult.rowCount === 1) {
        res.status(200).json({
          status: "already_whitelisted",
          message: "Requester is already approved in whitelist."
        });
        return;
      }

      const existingPending = await pool.query(
        `SELECT id, expires_at
         FROM connection_requests
         WHERE owner_identity_id = $1
           AND requester_normalized_anydesk_id = $2
           AND status = 'pending'
           AND expires_at > NOW()
         ORDER BY requested_at DESC
         LIMIT 1`,
        [ownerIdentity.id, requesterId.normalized]
      );

      if (existingPending.rowCount === 1) {
        res.status(202).json({
          request_id: existingPending.rows[0].id,
          status: "pending",
          expires_at: existingPending.rows[0].expires_at
        });
        return;
      }

      const expiresAt = new Date(Date.now() + config.CONNECTION_REQUEST_TTL_MIN * 60 * 1000);
      const insert = await pool.query(
        `INSERT INTO connection_requests (
           owner_identity_id,
           requester_normalized_anydesk_id,
           requester_display_anydesk_id,
           requester_label,
           note,
           status,
           expires_at
         )
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         RETURNING id, requested_at, expires_at`,
        [
          ownerIdentity.id,
          requesterId.normalized,
          requesterId.display,
          parsed.data.requester_label.trim() || null,
          parsed.data.note.trim() || null,
          expiresAt
        ]
      );

      if (ownerIdentity.legacy_admin_id) {
        await sendPushToAdmin(ownerIdentity.legacy_admin_id as string, {
          title: "Incoming AnyDesk Request",
          body: `${requesterId.display} requested access`,
          event_type: "incoming_request",
          request_id: insert.rows[0].id,
          owner_anydesk_id: ownerIdentity.display_anydesk_id
        });
      }

      res.status(201).json({
        request_id: insert.rows[0].id,
        status: "pending",
        requested_at: insert.rows[0].requested_at,
        expires_at: insert.rows[0].expires_at,
        owner_anydesk_id: ownerIdentity.display_anydesk_id
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid AnyDesk IDs." });
    }
  });

  return router;
}

export function createAdminRequestRoutes(): Router {
  const router = Router();

  router.get("/requests", requireAdmin, async (req: AdminRequest, res) => {
    const identityId = requireIdentity(req);
    if (!identityId) {
      res.status(403).json({ error: "Identity context is required for this operation." });
      return;
    }

    const status = String(req.query.status ?? "pending").trim().toLowerCase();
    const whereStatus = status === "all" ? "" : "AND status = $2";
    const params = status === "all" ? [identityId] : [identityId, status];

    const result = await pool.query(
      `SELECT id, requester_display_anydesk_id, requester_normalized_anydesk_id, requester_label, note, status,
              requested_at, expires_at, decided_at, decision_note
       FROM connection_requests
       WHERE owner_identity_id = $1 ${whereStatus}
       ORDER BY requested_at DESC
       LIMIT 200`,
      params
    );

    res.json({
      requests: result.rows.map((row) => ({
        id: row.id,
        requester_anydesk_id: row.requester_display_anydesk_id,
        requester_normalized_anydesk_id: row.requester_normalized_anydesk_id,
        requester_label: row.requester_label,
        note: row.note,
        status: row.status,
        requested_at: row.requested_at,
        expires_at: row.expires_at,
        decided_at: row.decided_at,
        decision_note: row.decision_note
      }))
    });
  });

  router.post("/requests/:id/decision", requireAdmin, async (req: AdminRequest, res) => {
    const identityId = requireIdentity(req);
    if (!identityId) {
      res.status(403).json({ error: "Identity context is required for this operation." });
      return;
    }

    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const requestResult = await pool.query(
      `SELECT id, owner_identity_id, requester_normalized_anydesk_id, requester_display_anydesk_id, requester_label, status, expires_at
       FROM connection_requests
       WHERE id = $1 AND owner_identity_id = $2
       LIMIT 1`,
      [req.params.id, identityId]
    );

    if (requestResult.rowCount !== 1) {
      res.status(404).json({ error: "Request not found." });
      return;
    }

    const requestRow = requestResult.rows[0];
    if (requestRow.status !== "pending") {
      res.status(409).json({ error: `Request already ${requestRow.status}.` });
      return;
    }

    if (new Date(requestRow.expires_at).getTime() < Date.now()) {
      await pool.query(
        `UPDATE connection_requests
         SET status = 'expired',
             decided_at = NOW(),
             decided_by_identity_id = $1
         WHERE id = $2`,
        [identityId, req.params.id]
      );
      res.status(410).json({ error: "Request expired." });
      return;
    }

    const nextStatus = parsed.data.decision === "approve" ? "approved" : "declined";
    await pool.query(
      `UPDATE connection_requests
       SET status = $1,
           decided_at = NOW(),
           decision_note = $2,
           decided_by_identity_id = $3
       WHERE id = $4`,
      [nextStatus, parsed.data.decision_note.trim() || null, identityId, req.params.id]
    );

    if (parsed.data.decision === "approve") {
      await pool.query(
        `INSERT INTO whitelist_entries (
           owner_identity_id,
           requester_normalized_anydesk_id,
           requester_display_anydesk_id,
           label,
           status,
           created_by_identity_id,
           updated_at
         )
         VALUES ($1, $2, $3, $4, 'active', $5, NOW())
         ON CONFLICT (owner_identity_id, requester_normalized_anydesk_id)
         DO UPDATE SET
           requester_display_anydesk_id = EXCLUDED.requester_display_anydesk_id,
           label = EXCLUDED.label,
           status = 'active',
           updated_at = NOW()`,
        [
          identityId,
          requestRow.requester_normalized_anydesk_id,
          requestRow.requester_display_anydesk_id,
          requestRow.requester_label || null,
          identityId
        ]
      );

      await emitAclSyncEvent(identityId, identityId);
    }

    res.status(200).json({
      request_id: req.params.id,
      status: nextStatus,
      requester_anydesk_id: requestRow.requester_display_anydesk_id
    });
  });

  return router;
}
