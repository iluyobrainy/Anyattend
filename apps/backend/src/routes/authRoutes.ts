import { Router } from "express";
import { z } from "zod";
import {
  createRefreshToken,
  getAdminById,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyAdminCredentials
} from "../services/authService.js";
import { config } from "../config.js";
import { requireAdmin, type AdminRequest } from "../middleware/adminAuth.js";
import { savePushSubscription } from "../services/pushService.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp_code: z.string().regex(/^\d{6}$/)
});

const refreshSchema = z.object({
  refresh_token: z.string().min(10)
});

const pushSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string()
  })
});

export function createAuthRoutes(): Router {
  const router = Router();

  router.post("/login", async (req, res) => {
    if (!config.ENABLE_LEGACY_AUTH || config.AUTH_MODE === "ANYDESK_ID_CHALLENGE") {
      res.status(410).json({
        error: "Legacy email/TOTP login is disabled. Use /v2/auth/admin/start and /v2/auth/admin/verify."
      });
      return;
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const admin = await verifyAdminCredentials(parsed.data.email, parsed.data.password, parsed.data.totp_code);
    if (!admin) {
      res.status(401).json({ error: "Invalid credentials or TOTP" });
      return;
    }

    const accessToken = signAccessToken({ sub: admin.id, email: admin.email, role: "admin" });
    const refreshToken = await createRefreshToken(admin.id);

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      admin: { id: admin.id, email: admin.email, role: "admin" }
    });
  });

  router.post("/refresh", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const rotated = await rotateRefreshToken(parsed.data.refresh_token);
    if (!rotated) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    const admin = await getAdminById(rotated.adminId);
    if (!admin) {
      res.status(401).json({ error: "Admin not found" });
      return;
    }

    const accessToken = signAccessToken({ sub: admin.id, email: admin.email, role: "admin" });

    res.json({
      access_token: accessToken,
      refresh_token: rotated.newToken
    });
  });

  router.post("/logout", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    await revokeRefreshToken(parsed.data.refresh_token);
    res.status(204).send();
  });

  router.post("/push/subscribe", requireAdmin, async (req: AdminRequest, res) => {
    const parsed = pushSchema.safeParse(req.body);
    if (!parsed.success || !req.admin) {
      res.status(400).json({ error: "Invalid push subscription" });
      return;
    }

    await savePushSubscription(req.admin.id, parsed.data);
    res.status(204).send();
  });

  return router;
}
