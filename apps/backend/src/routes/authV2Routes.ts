import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import {
  logoutAdminSession,
  rotateAdminSession,
  startAdminChallenge,
  verifyAdminChallenge
} from "../services/identityAuthService.js";
import { normalizeAnyDeskId } from "../services/anydeskIdService.js";

const startSchema = z.object({
  anydesk_id: z.string().min(1)
});

const verifySchema = z.object({
  challenge_id: z.string().uuid(),
  verification_code: z.string().regex(/^\d{6}$/)
});

const refreshSchema = z.object({
  refresh_token: z.string().min(16)
});

function getFingerprint(req: Request): string | null {
  const explicit = req.header("x-device-fingerprint");
  if (explicit?.trim()) {
    return explicit.trim().slice(0, 160);
  }
  const userAgent = req.header("user-agent") ?? "";
  return userAgent.trim() ? userAgent.slice(0, 160) : null;
}

export function createAuthV2Routes(): Router {
  const router = Router();

  router.post("/admin/start", async (req, res) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    try {
      const normalized = normalizeAnyDeskId(parsed.data.anydesk_id);
      const challenge = await startAdminChallenge(normalized.normalized);
      res.status(201).json({
        challenge_id: challenge.challenge_id,
        expires_at: challenge.expires_at,
        linked_device_id: challenge.linked_device_id,
        anydesk_id: normalized.display,
        delivery: challenge.delivery,
        ...(challenge.development_verification_code
          ? { development_verification_code: challenge.development_verification_code }
          : {})
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to start admin verification."
      });
    }
  });

  router.post("/admin/verify", async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    try {
      const session = await verifyAdminChallenge(
        parsed.data.challenge_id,
        parsed.data.verification_code,
        getFingerprint(req)
      );

      if (!session) {
        res.status(401).json({ error: "Invalid challenge or verification code." });
        return;
      }

      res.json(session);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Challenge verification failed."
      });
    }
  });

  router.post("/refresh", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const session = await rotateAdminSession(parsed.data.refresh_token, getFingerprint(req));
    if (!session) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    res.json(session);
  });

  router.post("/logout", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    await logoutAdminSession(parsed.data.refresh_token);
    res.status(204).send();
  });

  return router;
}
