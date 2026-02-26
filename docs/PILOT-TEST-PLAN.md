# Two-Laptop Pilot Test Checklist

## Environment

- Laptop A: Connectee (AnyDesk unattended target + Anyattend agent install)
- Laptop B: Requester (AnyDesk client)
- Phone: Admin PWA

## Steps

1. Backend + PWA online under HTTPS.
2. Login to PWA and generate pairing session.
3. On laptop A run provisioner with session/code.
4. Confirm device appears in dashboard.
5. Run each action from PWA and verify command ack appears.
6. Stop AnyDesk service on laptop A and verify recovery path.
7. Reboot laptop A and verify service + heartbeat recovery.
8. Disconnect/reconnect from laptop B and validate unattended reconnect.

## Metrics to capture

- Reconnect success rate.
- Mean reconnect duration.
- Daily restart/recovery counts.
- Command success/failure counts.
- Manual intervention count.
