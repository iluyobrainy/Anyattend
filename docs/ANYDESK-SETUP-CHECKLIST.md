# AnyDesk Configuration Checklist

Apply these in AnyDesk settings or central policy.

## Account and Security

- [ ] Device is assigned to managed AnyDesk account.
- [ ] Account 2FA is enabled.
- [ ] Recovery codes are stored in approved team password vault.

## Unattended Access

- [ ] Unattended access is enabled.
- [ ] Strong unattended password is set (20+ characters).
- [ ] Interactive "always ask" prompt is disabled for trusted allow-listed IDs.

## Access Control List (ACL)

- [ ] ACL mode is allow-list only.
- [ ] Only approved AnyDesk IDs/accounts are listed.
- [ ] Test from unauthorized AnyDesk ID is blocked.

## Session Permissions

- [ ] Permissions are least privilege (only required capabilities enabled).
- [ ] File transfer disabled unless explicitly needed.
- [ ] Privacy/security options match company policy.

## Startup

- [ ] AnyDesk starts with Windows.
- [ ] AnyDesk service startup is Automatic.
