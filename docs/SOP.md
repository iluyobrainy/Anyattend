# AnyDesk Remote Access SOP

## Purpose

Keep overseas laptop accessible without manual accept prompts, while maintaining security controls.

## Ownership

- Primary owner: Remote operations engineer
- Backup owner: IT support desk
- Escalation contact: Team lead / IT on-call

## Response Targets

- Acknowledge outage within 10 minutes.
- Begin troubleshooting within 15 minutes.
- Escalate to IT on-call if unresolved after 30 minutes.
- Post-incident note completed within 1 business day.

## Preconditions

- AnyDesk account 2FA enabled
- Unattended access enabled on remote laptop
- ACL restricted to approved AnyDesk IDs/accounts
- Watchdog task installed and enabled

## Normal Reconnect Procedure

1. Open AnyDesk on workstation or phone.
2. Connect to saved trusted endpoint.
3. Verify session opens without remote-side approval.
4. Confirm keyboard/mouse control works.

## If Connection Fails

1. Retry after 30-60 seconds.
2. Check local internet and VPN state.
3. Use phone AnyDesk app to test if endpoint is online.
4. If endpoint appears offline:
   - Ask remote-site contact to confirm laptop has power and network.
   - Ask contact to verify AnyDesk service is running.
5. If still failing, escalate to IT support with:
   - Time of failure
   - AnyDesk endpoint ID
   - Last successful connection time

## Break-Glass Actions

1. Use backup remote channel (VPN + RDP) if available.
2. Use administrator account to restart `AnyDesk` service.
3. Re-run hardening and validation scripts:
   - `.\scripts\harden-remote-host.ps1`
   - `.\scripts\validate-setup.ps1`

## Security Controls

- Unattended password stored in approved password vault only.
- ACL is allow-list only; deny unknown IDs.
- Session permissions are least privilege.
- Review AnyDesk logs weekly for unknown access attempts.

## Audit Logging

- Record every configuration change in `docs/CHANGELOG.md`.
- Keep test evidence in `docs/ACCEPTANCE-TESTS.md`.
