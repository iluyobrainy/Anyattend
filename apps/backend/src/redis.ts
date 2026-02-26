import { Redis } from "ioredis";
import { config } from "./config.js";

export const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch {
    // Redis is optional at runtime; DB polling remains functional.
  }
}

export async function closeRedis(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") {
    await redis.quit();
  }
}
