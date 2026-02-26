# Anyattend v1

Production-oriented scaffold for AnyDesk-compatible remote operations with:
- public website + installer download
- installable admin PWA
- Railway backend API
- Windows agent + provisioner + EXE packaging

## What this implementation contains

- `apps/backend`: TypeScript API for admin auth, device pairing, device heartbeats/alerts, command queue, and audit events.
- `apps/pwa`: Public landing/download site at `/` and installable admin PWA at `/app/*`.
- `agent/AnyattendAgent`: .NET 8 Windows Service scaffold (poll commands, heartbeat, alert, execute commands).
- `agent/AnyattendProvisioner`: .NET 8 CLI provisioning tool (pair + write `C:\ProgramData\Anyattend\agent.json` + DPAPI token).
- `installer/Anyattend.iss`: Inno Setup script for EXE installer packaging.
- `deploy/docker-compose.yml`: VPS deployment stack (Postgres, Redis, backend, PWA, Caddy).
- Existing PowerShell hardening scripts remain under `scripts/`.

## Implemented API surface

### Admin-side

- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/push/subscribe`
- `GET /v1/devices`
- `GET /v1/devices/{id}`
- `GET /v1/devices/{id}/events`
- `POST /v1/devices/{id}/actions`
- `POST /v1/devices/pairing/start`

### Device-side

- `POST /v1/device/pair/complete`
- `POST /v1/device/heartbeat`
- `POST /v1/device/alerts`
- `GET /v1/device/commands?since=<ISO-8601>`
- `POST /v1/device/commands/{id}/ack`

## Local development

### Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 16+
- Redis 7+
- (optional for agent build) .NET 8 SDK on Windows

### 1) Install dependencies

```powershell
Set-Location C:\Users\LENOVO\Desktop\Anyattend
npm install
```

### 2) Configure backend env

```powershell
Copy-Item .\apps\backend\.env.example .\apps\backend\.env
```

Edit secrets in `apps/backend/.env`.

### 3) Start backend

```powershell
npm run dev:backend
```

### 4) Configure PWA env

```powershell
Copy-Item .\apps\pwa\.env.example .\apps\pwa\.env
```

### 5) Start PWA

```powershell
npm run dev:pwa
```

PWA default URL: `http://localhost:5173`

## Agent provisioning flow (intended)

1. Admin logs into PWA and creates pairing session (`/app/pair`).
2. Installer/provisioner on connectee laptop submits:
   - `pairing_session_id`
   - `pairing_code`
3. Backend returns:
   - `device_id`
   - `device_token`
4. Provisioner writes config + DPAPI-protected token.
5. Windows service starts polling commands.

## Installer pipeline

1. Build agent binaries:

```powershell
.\agent\build-agent.ps1
```

2. Build installer (Inno Setup installed):

```powershell
.\installer\build-installer.ps1
```

3. Optional signing: pass signtool path + cert thumbprint to script.

## Deploy on VPS (Docker Compose)

1. Copy env template:

```powershell
Copy-Item .\deploy\.env.example .\deploy\.env
```

2. Set `ANYATTEND_DOMAIN`, secrets, and VAPID keys.
3. Run from `deploy/`:

```powershell
docker compose up -d --build
```

## Current limits in this environment

- `dotnet` is installed locally (`C:\Program Files\dotnet\dotnet.exe`), but shell PATH may require a new session.
- `docker` is not available on this machine, so compose deployment is scaffolded but not launched here.
- AnyDesk UI/policy settings (Unattended Access, ACL, permissions) still require manual configuration on target laptops.

## Security notes

- AnyDesk unattended password is not transmitted to backend.
- Device token is intended to be encrypted with Windows DPAPI on connectee laptop.
- Admin access uses password + TOTP + JWT + rotating refresh token.

## Go-Live Guide

- `docs/GO-LIVE-CHECKLIST.md`
- `docs/PILOT-RUNBOOK.md`
