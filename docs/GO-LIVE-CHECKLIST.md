# Go-Live Checklist (GitHub + Railway + Vercel)

## 0) Accounts and Tooling

- GitHub account (repo owner) with Actions enabled.
- Railway account logged in (`railway login`).
- Vercel account logged in (`vercel login`).
- Domain name configured (recommended).

## 1) Create and Push GitHub Repository

From `C:\Users\LENOVO\Desktop\Anyattend`:

```powershell
git init
git add .
git commit -m "feat: anyattend v1 scaffold"
```

Create an empty GitHub repo, then:

```powershell
git remote add origin <YOUR_GITHUB_REPO_URL>
git branch -M main
git push -u origin main
```

## 2) Backend on Railway

1. In Railway dashboard, create a new project from GitHub repo.
2. Select root repo as source.
3. Confirm `railway.json` is detected.
4. Add Postgres and Redis services from Railway templates/plugins.
5. Set backend environment variables:
   - `PORT=8080`
   - `DATABASE_URL=<Railway Postgres URL>`
   - `REDIS_URL=<Railway Redis URL>`
   - `JWT_SECRET=<strong secret>`
   - `COMMAND_SIGNING_SECRET=<strong secret>`
   - `JWT_EXPIRES_IN=15m`
   - `REFRESH_TOKEN_TTL_DAYS=30`
   - `PAIRING_SESSION_TTL_MIN=10`
   - `TOTP_WINDOW=1`
   - `VAPID_PUBLIC_KEY=<generated>`
   - `VAPID_PRIVATE_KEY=<generated>`
   - `VAPID_SUBJECT=mailto:<your-email>`
   - `BOOTSTRAP_ADMIN_EMAIL=<admin email>`
   - `BOOTSTRAP_ADMIN_PASSWORD=<strong password>`
   - `BOOTSTRAP_ADMIN_TOTP_SECRET=<base32 secret>`
   - `ALLOWED_ORIGINS=https://<your-vercel-domain>`
6. Deploy and copy backend public URL (for example `https://api-anyattend.up.railway.app`).

## 3) Generate VAPID Keys

Run locally:

```powershell
node .\deploy\scripts\generate-vapid-keys.mjs
```

Set both keys in Railway env and set `VITE_VAPID_PUBLIC_KEY` in Vercel.

## 4) PWA + Website on Vercel

Deploy from `apps/pwa`:

```powershell
Set-Location C:\Users\LENOVO\Desktop\Anyattend\apps\pwa
vercel
```

When prompted:
- Link/create project under your Vercel account.
- Keep framework: `Vite`.

Set Vercel env vars:
- `VITE_API_BASE_URL=https://<your-railway-backend-url>`
- `VITE_VAPID_PUBLIC_KEY=<same public key as Railway>`
- `VITE_WINDOWS_EXE_URL=https://github.com/<owner>/<repo>/releases/latest/download/Anyattend-Setup.exe`

Then deploy production:

```powershell
vercel --prod
```

If your deployment returns a Vercel Authentication page, disable deployment protection:
1. Vercel Project Settings
2. Deployment Protection
3. Turn off `Vercel Authentication` for Production

## 5) Build EXE via GitHub Actions

1. In GitHub, create a tag:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

2. Workflow `Release Installer` builds `Anyattend-Setup.exe` and attaches it to release.
3. The landing page download button points to `releases/latest/download/Anyattend-Setup.exe`.

## 6) Connectee Laptop (your main accepting laptop)

1. Open website and download installer EXE.
2. Install Anyattend.
3. In web app, go to `Pair Device` and generate pairing code/session.
4. Run provisioner with:
   - backend URL
   - pairing session ID
   - pairing code
   - command signing secret
5. Confirm device appears online in dashboard.
6. Configure AnyDesk unattended mode + ACL allow-list.

## 7) Requester Laptop Test (second laptop / AWS Windows)

1. Use AnyDesk client to connect to your main laptop ID.
2. Reconnect after transient network drop.
3. Confirm no manual accept is needed.
4. From phone/webapp, trigger:
   - `RESTART_ANYDESK_SERVICE`
   - `LOCK_REMOTE`
   - `UNLOCK_REMOTE`
5. Confirm command acks and event logs.

## 8) Acceptance Gate

- Device visible and online in web app.
- Pairing completes successfully.
- PWA install works on phone.
- EXE download works from public link.
- AnyDesk reconnect works without manual walk-up.
- Command actions execute and acknowledge.
