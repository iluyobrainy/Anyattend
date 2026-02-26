import webpush from "web-push";
import { pool } from "../db.js";
import { config } from "../config.js";

const hasPushConfig = Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);

if (hasPushConfig) {
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
}

export function isPushEnabled(): boolean {
  return hasPushConfig;
}

export async function savePushSubscription(adminId: string, subscription: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO push_subscriptions (admin_id, subscription_json)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (admin_id, subscription_json) DO NOTHING`,
    [adminId, JSON.stringify(subscription)]
  );
}

export async function sendPushToAdmin(adminId: string, payload: Record<string, unknown>): Promise<void> {
  if (!hasPushConfig) {
    return;
  }

  const result = await pool.query(
    `SELECT id, subscription_json FROM push_subscriptions WHERE admin_id = $1`,
    [adminId]
  );

  const body = JSON.stringify(payload);

  for (const row of result.rows) {
    try {
      await webpush.sendNotification(row.subscription_json, body);
    } catch {
      await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [row.id]);
    }
  }
}
