# Changelog

## 2026-02-26

- Created initial Anyattend implementation package.
- Added watchdog script with exit code contract:
  - `0` healthy
  - `1` restarted successfully
  - `2` restart failed
- Added watchdog config schema:
  - `service_name`
  - `check_interval_sec`
  - `alert_webhook_url`
- Added Scheduled Task installer for startup + periodic health checks.
- Added host hardening script for power, NIC, and service startup settings.
- Added setup validation script.
- Added SOP and acceptance test documentation.
- Added production scaffold:
  - `apps/backend` (auth, pairing, device APIs, commands, events, push subscription storage)
  - `apps/pwa` (installable admin PWA with login/dashboard/pairing/actions)
  - `agent/AnyattendAgent` (.NET Windows Service scaffold)
  - `agent/AnyattendProvisioner` (pairing CLI with DPAPI token storage)
  - `deploy/docker-compose.yml` (Postgres + Redis + backend + pwa + caddy)
  - `installer/Anyattend.iss` (Inno Setup installer script)
- Added deployment automation:
  - `.github/workflows/ci.yml`
  - `.github/workflows/release-installer.yml`
  - `railway.json`
  - `apps/pwa/vercel.json`
- Added public landing/download page route in PWA (`/`).
- Added go-live runbook: `docs/GO-LIVE-CHECKLIST.md`.
- Split deployment surfaces:
  - `apps/site` for public Anyattend website + Windows download
  - `apps/pwa` for separate admin web app
