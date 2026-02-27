import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, type AdminRequest } from "../middleware/adminAuth.js";
import { activateRole, getIdentityRoles } from "../services/identityAuthService.js";
import { formatAnyDeskId, normalizeAnyDeskId } from "../services/anydeskIdService.js";

const whitelistCreateSchema = z.object({
  anydesk_id: z.string().min(1),
  label: z.string().max(80).optional().default("")
});

const activateRoleSchema = z.object({
  role: z.enum(["admin", "connectee"])
});

function requireIdentity(req: AdminRequest): string | null {
  return req.admin?.identityId ?? null;
}

export function createV2Routes(): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get("/whitelist", async (req: AdminRequest, res) => {
    const identityId = requireIdentity(req);
    if (!identityId) {
      res.status(403).json({ error: "Identity context is required for this operation." });
      return;
    }

    const result = await pool.query(
      `SELECT id, requester_normalized_anydesk_id, requester_display_anydesk_id, label, status, created_at, updated_at
       FROM whitelist_entries
       WHERE owner_identity_id = $1
       ORDER BY updated_at DESC`,
      [identityId]
    );

    res.json({
      entries: result.rows.map((row) => ({
        id: row.id,
        anydesk_id: formatAnyDeskId(row.requester_normalized_anydesk_id),
        normalized_anydesk_id: row.requester_normalized_anydesk_id,
        label: row.label,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at
      }))
    });
  });

  router.post("/whitelist", async (req: AdminRequest, res) => {
    const identityId = requireIdentity(req);
    if (!identityId) {
      res.status(403).json({ error: "Identity context is required for this operation." });
      return;
    }

    const parsed = whitelistCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    try {
      const normalized = normalizeAnyDeskId(parsed.data.anydesk_id);
      const result = await pool.query(
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
           updated_at = NOW()
         RETURNING id, requester_normalized_anydesk_id, requester_display_anydesk_id, label, status, created_at, updated_at`,
        [identityId, normalized.normalized, normalized.display, parsed.data.label.trim() || null, identityId]
      );

      res.status(201).json({
        entry: {
          id: result.rows[0].id,
          anydesk_id: result.rows[0].requester_display_anydesk_id,
          normalized_anydesk_id: result.rows[0].requester_normalized_anydesk_id,
          label: result.rows[0].label,
          status: result.rows[0].status,
          created_at: result.rows[0].created_at,
          updated_at: result.rows[0].updated_at
        }
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid AnyDesk ID."
      });
    }
  });

  router.delete("/whitelist/:id", async (req: AdminRequest, res) => {
    const identityId = requireIdentity(req);
    if (!identityId) {
      res.status(403).json({ error: "Identity context is required for this operation." });
      return;
    }

    const result = await pool.query(
      `DELETE FROM whitelist_entries
       WHERE id = $1 AND owner_identity_id = $2
       RETURNING id`,
      [req.params.id, identityId]
    );

    if (result.rowCount !== 1) {
      res.status(404).json({ error: "Whitelist entry not found." });
      return;
    }

    res.status(204).send();
  });

  router.post("/whitelist/sync", async (req: AdminRequest, res) => {
    const identityId = requireIdentity(req);
    if (!identityId) {
      res.status(403).json({ error: "Identity context is required for this operation." });
      return;
    }

    const entriesResult = await pool.query(
      `SELECT requester_normalized_anydesk_id, requester_display_anydesk_id, label
       FROM whitelist_entries
       WHERE owner_identity_id = $1 AND status = 'active'
       ORDER BY updated_at DESC`,
      [identityId]
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
       RETURNING id, result_status, created_at, completed_at`,
      [identityId, identityId, JSON.stringify(payload)]
    );

    const devicesResult = await pool.query(
      `SELECT id
       FROM devices
       WHERE owner_identity_id = $1`,
      [identityId]
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

    res.status(202).json({
      sync_event: {
        id: syncInsert.rows[0].id,
        result_status: syncInsert.rows[0].result_status,
        created_at: syncInsert.rows[0].created_at,
        completed_at: syncInsert.rows[0].completed_at
      },
      entries_synced: payload.entries.length
    });
  });

  router.get("/me/roles", async (req: AdminRequest, res) => {
    const identityId = requireIdentity(req);
    if (!identityId) {
      res.status(403).json({ error: "Identity context is required for this operation." });
      return;
    }

    const roles = await getIdentityRoles(identityId);
    if (!roles) {
      res.status(404).json({ error: "Identity not found." });
      return;
    }

    res.json(roles);
  });

  router.post("/me/roles/activate", async (req: AdminRequest, res) => {
    const identityId = requireIdentity(req);
    if (!identityId) {
      res.status(403).json({ error: "Identity context is required for this operation." });
      return;
    }

    const parsed = activateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const activated = await activateRole(identityId, parsed.data.role);
    if (!activated) {
      res.status(400).json({ error: "Role is not available for this identity." });
      return;
    }

    res.status(204).send();
  });

  return router;
}
