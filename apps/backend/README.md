# Anyattend Backend

## Setup

1. Copy `.env.example` to `.env` and set secrets.
2. Start Postgres + Redis.
3. Install deps from repository root: `npm install`
4. Run backend: `npm run dev -w apps/backend`

## API Prefixes

- Admin auth: `/v1/auth/*`
- Admin device APIs: `/v1/*`
- Device agent APIs: `/v1/device/*`

## Bootstrap Admin

On startup, backend ensures a bootstrap admin from env vars exists.
Use that account for first login in the PWA.
