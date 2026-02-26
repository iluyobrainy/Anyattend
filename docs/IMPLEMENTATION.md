# Implementation Notes

## Components

1. Backend (`apps/backend`)
- Express + Postgres + optional Redis queue hints.
- Pairing session model with code hashing.
- Command envelope creation with HMAC signature.
- Audit events and push subscription persistence.

2. PWA (`apps/pwa`)
- Installable manifest + service worker.
- Login with email/password/TOTP.
- Device dashboard and actions.
- Pairing session generator with QR payload.

3. Agent (`agent/AnyattendAgent`)
- Windows Service loop:
  - heartbeat
  - command poll
  - local execution
  - command ack
- Uses DPAPI token from `C:\ProgramData\Anyattend\device.token`.

4. Provisioner (`agent/AnyattendProvisioner`)
- One-time pairing call to backend.
- Writes config and encrypted token.

5. Installer (`installer/Anyattend.iss`)
- Packages agent, provisioner, and operational scripts.
- Creates/stops/deletes Windows service on install/uninstall.

## Command Types

- `RUN_VALIDATION`
- `RESTART_ANYDESK_SERVICE`
- `LOCK_REMOTE`
- `UNLOCK_REMOTE`
- `REFRESH_STATUS`

## Alert schema

```json
{
  "host": "HOSTNAME",
  "timestamp": "2026-02-26T10:00:00.000Z",
  "status": "critical",
  "action_taken": "service_restarted",
  "details": {}
}
```
