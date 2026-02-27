export type CommandType =
  | "RUN_VALIDATION"
  | "RESTART_ANYDESK_SERVICE"
  | "LOCK_REMOTE"
  | "UNLOCK_REMOTE"
  | "REFRESH_STATUS";

export type DeviceStatus = "online" | "offline" | "degraded" | "critical";

export interface JwtClaims {
  sub: string;
  email?: string;
  anydesk_id?: string;
  display_anydesk_id?: string;
  identity_id?: string;
  legacy_admin_id?: string;
  role: "admin";
}

export interface CommandEnvelope {
  id: string;
  type: CommandType;
  payload: Record<string, unknown>;
  nonce: string;
  expires_at: string;
  signature: string;
}
