import { useState } from "react";
import { startAdminAuth, verifyAdminAuth, type ChallengeStartResponse, type SessionState } from "../api/client";
import { normalizeAnyDeskIdInput, validateAnyDeskId } from "../utils/anydeskId";

export function LoginPage({ onLogin }: { onLogin: (session: SessionState) => void }) {
  const [anydeskId, setAnydeskId] = useState("");
  const [challenge, setChallenge] = useState<ChallengeStartResponse | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isVerifyStep = Boolean(challenge);

  return (
    <div className="login-page">
      <section className="login-panel">
        <p className="brand-tag">Anyattend Admin</p>
        <h1>AnyDesk ID Verification</h1>
        <p className="muted">
          Sign in with your AnyDesk ID and ownership challenge code. Spaces are accepted (example: 806 716 144).
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (!isVerifyStep) {
                const validationError = validateAnyDeskId(anydeskId);
                if (validationError) {
                  throw new Error(validationError);
                }

                const { normalized } = normalizeAnyDeskIdInput(anydeskId);
                const started = await startAdminAuth(normalized);
                setChallenge(started);
                setAnydeskId(started.anydesk_id);
                return;
              }

              if (!/^\d{6}$/.test(verificationCode)) {
                throw new Error("Verification code must be exactly 6 digits.");
              }

              const session = await verifyAdminAuth(challenge!.challenge_id, verificationCode);
              onLogin(session);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Authentication failed");
            } finally {
              setBusy(false);
            }
          }}
          className="form-grid"
        >
          <label>
            AnyDesk ID
            <input
              value={anydeskId}
              onChange={(e) => setAnydeskId(normalizeAnyDeskIdInput(e.target.value).display)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="806 716 144"
              disabled={isVerifyStep}
              required
            />
            {!isVerifyStep ? <span className="input-hint">Use digits only; spacing is formatted automatically.</span> : null}
          </label>

          {isVerifyStep ? (
            <label>
              Verification Code
              <input
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D+/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                required
              />
              <span className="input-hint">Enter the 6-digit ownership challenge code.</span>
            </label>
          ) : null}

          {challenge ? (
            <div className="detail-inline">
              <p className="muted">Challenge ID: {challenge.challenge_id}</p>
              <p className="muted">Expires: {new Date(challenge.expires_at).toLocaleString()}</p>
              <p className="muted">{challenge.delivery.note}</p>
              {challenge.development_verification_code ? (
                <p className="debug-chip">Dev code: {challenge.development_verification_code}</p>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="error-msg">{error}</p> : null}
          <div className="button-row">
            {isVerifyStep ? (
              <button
                className="ghost-btn"
                type="button"
                disabled={busy}
                onClick={() => {
                  setChallenge(null);
                  setVerificationCode("");
                  setError("");
                }}
              >
                Back
              </button>
            ) : null}
            <button className="primary-btn" type="submit" disabled={busy}>
              {busy ? "Working..." : isVerifyStep ? "Verify and Sign In" : "Start Verification"}
            </button>
          </div>
        </form>
      </section>
      <aside className="login-aside">
        <div className="stat-card">
          <h2>ID Model</h2>
          <p>AnyDesk ID is normalized as digits-only and displayed with grouped spacing.</p>
        </div>
        <div className="stat-card">
          <h2>Whitelist</h2>
          <p>Approved requester IDs are managed in the app and synced for ACL workflows.</p>
        </div>
        <div className="stat-card">
          <h2>Roles</h2>
          <p>Verified identities can switch between admin and connectee modes without re-pairing.</p>
        </div>
      </aside>
    </div>
  );
}
