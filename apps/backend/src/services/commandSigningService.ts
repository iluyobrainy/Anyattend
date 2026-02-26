import crypto from "node:crypto";
import type { CommandType } from "../types/index.js";
import { config } from "../config.js";

export function createNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function signCommand(command: {
  id: string;
  deviceId: string;
  type: CommandType;
  payload: Record<string, unknown>;
  nonce: string;
  expiresAt: string;
}): string {
  const canonical = JSON.stringify({
    id: command.id,
    device_id: command.deviceId,
    type: command.type,
    payload: command.payload,
    nonce: command.nonce,
    expires_at: command.expiresAt
  });

  return crypto.createHmac("sha256", config.COMMAND_SIGNING_SECRET).update(canonical).digest("hex");
}
