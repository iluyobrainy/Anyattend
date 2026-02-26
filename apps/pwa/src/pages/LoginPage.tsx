import { useState } from "react";
import { login, type SessionState } from "../api/client";

export function LoginPage({ onLogin }: { onLogin: (session: SessionState) => void }) {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="login-page">
      <section className="login-panel">
        <p className="brand-tag">Anyattend Admin</p>
        <h1>Secure Remote Operations</h1>
        <p className="muted">
          Sign in with password + TOTP to monitor device health, dispatch commands, and verify unattended access status.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const session = await login(email, password, totp);
              onLogin(session);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Login failed");
            } finally {
              setBusy(false);
            }
          }}
          className="form-grid"
        >
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>
          <label>
            TOTP Code
            <input
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              placeholder="123456"
              required
            />
          </label>
          {error ? <p className="error-msg">{error}</p> : null}
          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
      <aside className="login-aside">
        <div className="stat-card">
          <h2>Model</h2>
          <p>AnyDesk unattended access + ACL + agent watchdog.</p>
        </div>
        <div className="stat-card">
          <h2>Controls</h2>
          <p>Restart service, lock/unlock remote endpoint, run validation.</p>
        </div>
        <div className="stat-card">
          <h2>Delivery</h2>
          <p>Installable PWA from browser, real-time push alerts.</p>
        </div>
      </aside>
    </div>
  );
}
