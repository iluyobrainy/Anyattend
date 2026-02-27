# Anyattend Backend

## Setup

1. Copy `.env.example` to `.env` and set secrets.
2. Start Postgres + Redis.
3. Install deps from repository root: `npm install`
4. Run backend: `npm run dev -w apps/backend`

## API Prefixes

- API banner: `/`
- Health: `/health`
- Admin auth (primary): `/v2/auth/*`
- Whitelist + role APIs: `/v2/*`
- Incoming requests (admin): `/v2/requests`, `/v2/requests/:id/decision`
- Incoming requests (public submit): `/v2/public/requests`
- Device enrollment (v1.1): `/v2/device/enroll`
- Legacy admin auth (feature-flagged): `/v1/auth/*`
- Admin device APIs (existing): `/v1/*`
- Device agent APIs: `/v1/device/*`

## Bootstrap Admin

On startup, backend can ensure a bootstrap admin from env vars exists for legacy auth.
In `AUTH_MODE=ANYDESK_ID_CHALLENGE`, primary login is AnyDesk ID + ownership challenge.
