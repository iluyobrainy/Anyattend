import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createAuthV2Routes } from "./routes/authV2Routes.js";
import { createAdminRoutes } from "./routes/adminRoutes.js";
import { createDeviceRoutes } from "./routes/deviceRoutes.js";
import { createAdminRequestRoutes, createPublicRequestRoutes } from "./routes/requestRoutes.js";
import { createV2DeviceRoutes } from "./routes/v2DeviceRoutes.js";
import { createV2Routes } from "./routes/v2Routes.js";
import { isPushEnabled } from "./services/pushService.js";

export function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin denied"));
      },
      credentials: true
    })
  );

  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      name: "Anyattend Backend API",
      version: "1.1",
      auth_mode: config.AUTH_MODE,
      endpoints: {
        health: "/health",
        v1: "/v1",
        v2: "/v2"
      }
    });
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      auth_mode: config.AUTH_MODE,
      push_enabled: isPushEnabled(),
      timestamp: new Date().toISOString()
    });
  });

  app.use("/v1/auth", createAuthRoutes());
  app.use("/v2/auth", createAuthV2Routes());
  app.use("/v2/public", createPublicRequestRoutes());
  app.use("/v1", createAdminRoutes());
  app.use("/v2", createAdminRequestRoutes());
  app.use("/v2", createV2Routes());
  app.use("/v1/device", createDeviceRoutes());
  app.use("/v2/device", createV2DeviceRoutes());

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Internal server error", detail: error.message });
  });

  return app;
}
