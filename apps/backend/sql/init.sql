CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  host TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen TIMESTAMPTZ,
  poll_interval_sec INTEGER NOT NULL DEFAULT 60,
  service_name TEXT NOT NULL DEFAULT 'AnyDesk',
  webhook_fallback_url TEXT,
  api_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paired_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pairing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  owner_identity_id UUID,
  device_label TEXT NOT NULL,
  pairing_code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  issued_by UUID REFERENCES admins(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  nonce TEXT NOT NULL,
  signature TEXT NOT NULL,
  acked_at TIMESTAMPTZ,
  ack_status TEXT,
  ack_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_commands_device_status ON commands(device_id, status, issued_at DESC);

CREATE TABLE IF NOT EXISTS device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_events_device_time ON device_events(device_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(admin_id, subscription_json)
);

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS owner_identity_id UUID;

ALTER TABLE pairing_sessions
  ADD COLUMN IF NOT EXISTS owner_identity_id UUID;

CREATE TABLE IF NOT EXISTS identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_anydesk_id TEXT NOT NULL UNIQUE,
  display_anydesk_id TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  verification_method TEXT,
  active_role TEXT NOT NULL DEFAULT 'connectee',
  legacy_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'devices_owner_identity_id_fkey'
  ) THEN
    ALTER TABLE devices
      ADD CONSTRAINT devices_owner_identity_id_fkey
      FOREIGN KEY (owner_identity_id) REFERENCES identities(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'pairing_sessions_owner_identity_id_fkey'
  ) THEN
    ALTER TABLE pairing_sessions
      ADD CONSTRAINT pairing_sessions_owner_identity_id_fkey
      FOREIGN KEY (owner_identity_id) REFERENCES identities(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS identity_roles (
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'connectee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(identity_id, role)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_identity ON admin_sessions(identity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ownership_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  challenge_code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ownership_challenges_identity_time ON ownership_challenges(identity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whitelist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  requester_normalized_anydesk_id TEXT NOT NULL,
  requester_display_anydesk_id TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_identity_id UUID REFERENCES identities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_identity_id, requester_normalized_anydesk_id)
);

CREATE INDEX IF NOT EXISTS idx_whitelist_owner_status ON whitelist_entries(owner_identity_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS acl_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  requested_by_identity_id UUID REFERENCES identities(id) ON DELETE SET NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_status TEXT NOT NULL,
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acl_sync_owner_time ON acl_sync_events(owner_identity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  requester_normalized_anydesk_id TEXT NOT NULL,
  requester_display_anydesk_id TEXT NOT NULL,
  requester_label TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  decided_by_identity_id UUID REFERENCES identities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_connection_requests_owner_status_time
  ON connection_requests(owner_identity_id, status, requested_at DESC);
