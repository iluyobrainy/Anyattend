import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  DEVICE_TOKEN_BYTES: z.coerce.number().default(48),
  COMMAND_SIGNING_SECRET: z.string().min(16),
  PAIRING_CODE_TTL_MIN: z.coerce.number().default(10),
  PAIRING_SESSION_TTL_MIN: z.coerce.number().default(10),
  TOTP_WINDOW: z.coerce.number().default(1),
  VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().default("mailto:admin@example.com"),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12),
  BOOTSTRAP_ADMIN_TOTP_SECRET: z.string().min(8),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(",").map((x) => x.trim()).filter(Boolean)
};
