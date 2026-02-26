import { useState } from "react";
import QRCode from "qrcode";
import { startPairing } from "../api/devices";

export function PairingPage() {
  const [deviceLabel, setDeviceLabel] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className="pairing-layout">
      <div className="detail-card">
        <h2>Create Pairing Session</h2>
        <p className="muted">
          Run this from your admin phone/web app. Then enter the generated pairing code/session in the connectee laptop
          installer wizard.
        </p>

        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await startPairing(deviceLabel.trim());
              setPairingCode(result.pairing_code);
              setSessionId(result.pairing_session_id);
              setExpiresAt(result.expires_at);
              setQrImage(await QRCode.toDataURL(result.qr_payload, { width: 280, margin: 1 }));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to create pairing session");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Device label
            <input
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
              placeholder="Overseas Laptop A"
              minLength={3}
              required
            />
          </label>
          {error ? <p className="error-msg">{error}</p> : null}
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? "Creating..." : "Generate Pairing"}
          </button>
        </form>
      </div>

      <div className="detail-card">
        <h3>Pairing Output</h3>
        {!pairingCode ? (
          <p className="muted">Generate a pairing session to see QR + code.</p>
        ) : (
          <>
            {qrImage ? <img src={qrImage} alt="pairing QR" className="qr-image" /> : null}
            <p>
              <strong>Pairing Code:</strong> {pairingCode}
            </p>
            <p>
              <strong>Session ID:</strong> {sessionId}
            </p>
            <p>
              <strong>Expires:</strong> {new Date(expiresAt).toLocaleString()}
            </p>
            <p className="muted">Use these values in the installer pairing step on the connectee laptop.</p>
          </>
        )}
      </div>
    </section>
  );
}
