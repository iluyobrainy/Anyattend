import { useState } from "react";
import { startAdminAuth, type ChallengeStartResponse } from "../api/client";
import { normalizeAnyDeskIdInput, validateAnyDeskId } from "../utils/anydeskId";

export function PairingPage() {
  const [anydeskId, setAnydeskId] = useState("");
  const [challenge, setChallenge] = useState<ChallengeStartResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <section className="pairing-layout">
      <div className="detail-card">
        <h2>Installer Ownership Challenge</h2>
        <p className="muted">
          Generate the ownership challenge used by the Windows installer (`AnyDesk ID + challenge code`).
        </p>

        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            setChallenge(null);
            try {
              const validation = validateAnyDeskId(anydeskId);
              if (validation) {
                throw new Error(validation);
              }
              const { normalized, display } = normalizeAnyDeskIdInput(anydeskId);
              const result = await startAdminAuth(normalized);
              setAnydeskId(display);
              setChallenge(result);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to create ownership challenge.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            AnyDesk ID
            <input
              value={anydeskId}
              onChange={(e) => setAnydeskId(normalizeAnyDeskIdInput(e.target.value).display)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="806 716 144"
              required
            />
            <span className="input-hint">Spacing is optional; this field auto-formats.</span>
          </label>
          {error ? <p className="error-msg">{error}</p> : null}
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? "Generating..." : "Generate Challenge"}
          </button>
        </form>
      </div>

      <div className="detail-card">
        <h3>Challenge Output</h3>
        {!challenge ? (
          <p className="muted">Generate a challenge to get installer values.</p>
        ) : (
          <div className="detail-inline">
            <p>
              <strong>AnyDesk ID:</strong> {challenge.anydesk_id}
            </p>
            <p>
              <strong>Challenge ID:</strong> {challenge.challenge_id}
            </p>
            <p>
              <strong>Expires:</strong> {new Date(challenge.expires_at).toLocaleString()}
            </p>
            <p className="muted">{challenge.delivery.note}</p>
            {challenge.development_verification_code ? (
              <p>
                <strong>Installer code:</strong> {challenge.development_verification_code}
              </p>
            ) : (
              <p className="muted">Verification code is hidden in production mode.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
