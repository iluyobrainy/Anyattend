# Acceptance Tests

Run these tests on the remote Windows laptop after setup.

## Test 1: Reconnect After Network Drop

1. Start active AnyDesk session.
2. Disable local internet for 30-60 seconds.
3. Re-enable internet and reconnect.
4. Expected: session reconnects without manual remote acceptance.

## Test 2: Unauthorized Access Attempt

1. Attempt connection from AnyDesk ID not in ACL allow-list.
2. Expected: access is denied/blocked.

## Test 3: Service Recovery

1. On remote host, run: `Stop-Service -Name AnyDesk`
2. Wait for watchdog schedule interval.
3. Expected: watchdog restarts service; status returns to running.
4. If webhook configured, verify alert payload includes:
   - `host`
   - `timestamp`
   - `status`
   - `action_taken`

## Test 4: Reboot Persistence

1. Reboot remote laptop.
2. After boot, verify:
   - AnyDesk service is running
   - Scheduled task exists and is enabled
   - Unattended connection works

## Test 5: Mobile Path Validation

1. Connect using AnyDesk mobile app.
2. Connect using primary workstation.
3. Expected: both connect without remote-side manual approval.

## Evidence Table

| Date (UTC) | Tester | Test ID | Result (Pass/Fail) | Notes |
|---|---|---|---|---|
|  |  | T1 |  |  |
|  |  | T2 |  |  |
|  |  | T3 |  |  |
|  |  | T4 |  |  |
|  |  | T5 |  |  |
