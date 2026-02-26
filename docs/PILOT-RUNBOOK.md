# Pilot Runbook (Two Laptops + Phone)

## 1) Backend and PWA

1. Provision VPS and DNS.
2. In `deploy/.env`, set all secrets + domain + VAPID keys.
3. Run `docker compose up -d --build` from `deploy/`.
4. Open `https://<your-domain>` from phone and install PWA to home screen.

## 2) Pair connectee laptop (Laptop A)

1. In PWA, create pairing session (`Pair Device`).
2. On Laptop A, run Anyattend installer and provisioner with:
   - backend URL
   - pairing session ID
   - pairing code
   - command signing secret
   Example:
   ```powershell
   "C:\Program Files\Anyattend\provisioner\AnyattendProvisioner.exe" `
     --backend-url "https://<railway-backend-url>" `
     --pairing-session-id "<uuid>" `
     --pairing-code "<123456>" `
     --command-signing-secret "<same as backend COMMAND_SIGNING_SECRET>"
   ```
3. Ensure Windows service `AnyattendAgent` is running.
4. Verify laptop appears online in dashboard.

## 3) Configure AnyDesk on Laptop A

1. Enable unattended access.
2. Set strong unattended password.
3. Restrict ACL to trusted IDs only.
4. Disable manual accept for trusted IDs.

## 4) Validate requester path (Laptop B)

1. Connect to Laptop A AnyDesk ID.
2. Disconnect/reconnect after local network flap.
3. Confirm no remote manual approval is needed.

## 5) Action and alert validation

1. From PWA issue `RESTART_ANYDESK_SERVICE` and verify ack.
2. Issue `LOCK_REMOTE` then `UNLOCK_REMOTE` and verify AnyDesk availability changes.
3. Stop AnyDesk service on Laptop A manually and verify watchdog alert appears.

## 6) Reboot persistence

1. Reboot Laptop A.
2. Verify Anyattend service auto-start and heartbeat recovery.
3. Re-test AnyDesk unattended reconnect from Laptop B.
