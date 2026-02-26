import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createAdminRoutes } from "./routes/adminRoutes.js";
import { createDeviceRoutes } from "./routes/deviceRoutes.js";
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

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      push_enabled: isPushEnabled(),
      timestamp: new Date().toISOString()
    });
  });

  app.use("/v1/auth", createAuthRoutes());
  app.use("/v1", createAdminRoutes());
  app.use("/v1/device", createDeviceRoutes());

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Internal server error", detail: error.message });
  });

  return app;
}
