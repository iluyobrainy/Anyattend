import { useState } from "react";

const webAppUrl = import.meta.env.VITE_WEBAPP_URL ?? "https://anyattend-admin.vercel.app";
const downloadUrl = import.meta.env.VITE_WINDOWS_EXE_URL ?? "/downloads/Anyattend-Setup.exe";
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "https://backend-production-1497.up.railway.app";

export function App() {
  const [ownerId, setOwnerId] = useState("");
  const [requesterId, setRequesterId] = useState("");
  const [requesterLabel, setRequesterLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");

  return (
    <div className="page">
      <div className="noise" aria-hidden="true" />
      <header className="top-nav">
        <div className="brand">Anyattend</div>
        <a className="pill-link" href={webAppUrl} target="_blank" rel="noreferrer">
          Open Admin Web App
        </a>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">Windows Remote Access Control</p>
          <h1>Keep AnyDesk sessions stable without walking to the laptop.</h1>
          <p className="hero-copy">
            Anyattend installs on your Windows connectee laptop, monitors health, and gives admins phone-first control via a
            dedicated web app.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href={downloadUrl} target="_blank" rel="noreferrer">
              Download for Windows
            </a>
            <a className="btn secondary" href={webAppUrl} target="_blank" rel="noreferrer">
              Launch Admin Web App
            </a>
          </div>
          <div className="meta-strip">
            <span>Available now for Windows 10/11</span>
            <span>AnyDesk-compatible workflow</span>
            <span>PWA control from phone</span>
          </div>
        </section>

        <section className="card request-card">
          <h2>Request Access</h2>
          <p>Requester can submit an access request. The admin sees it in PWA Incoming Requests and can approve or decline.</p>
          <form
            className="request-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setStatusError("");
              setStatusMessage("");
              try {
                const response = await fetch(`${apiBase}/v2/public/requests`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    owner_anydesk_id: ownerId,
                    requester_anydesk_id: requesterId,
                    requester_label: requesterLabel,
                    note
                  })
                });

                const payload = (await response.json().catch(() => ({}))) as {
                  status?: string;
                  error?: string;
                  request_id?: string;
                };
                if (!response.ok) {
                  throw new Error(payload.error || "Unable to submit request.");
                }

                setStatusMessage(
                  payload.status === "already_whitelisted"
                    ? "This requester is already in whitelist. No pending approval item will appear in Requests."
                    : `Request submitted (${payload.request_id ?? "queued"}). Admin can now approve/decline in PWA Requests.`
                );
                setRequesterLabel("");
                setNote("");
              } catch (err) {
                setStatusError(err instanceof Error ? err.message : "Request failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Admin AnyDesk ID
              <input
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                placeholder="806 716 144"
                required
                maxLength={20}
              />
            </label>
            <label>
              Requester AnyDesk ID
              <input
                value={requesterId}
                onChange={(e) => setRequesterId(e.target.value)}
                placeholder="123 456 789"
                required
                maxLength={20}
              />
            </label>
            <label>
              Requester label (optional)
              <input
                value={requesterLabel}
                onChange={(e) => setRequesterLabel(e.target.value)}
                placeholder="My workstation"
                maxLength={80}
              />
            </label>
            <label>
              Note (optional)
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Need access for shift handoff" maxLength={240} />
            </label>
            {statusError ? <p className="form-error">{statusError}</p> : null}
            {statusMessage ? <p className="form-success">{statusMessage}</p> : null}
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send Request"}
            </button>
          </form>
        </section>

        <section className="grid">
          <article className="card">
            <h2>Installer-first workflow</h2>
            <p>
              Download a single EXE, install the service, pair the device, and start monitoring. No manual script execution
              required.
            </p>
          </article>
          <article className="card">
            <h2>Separate admin app</h2>
            <p>
              The admin web app runs independently with login, pairing, status, command actions, incoming requests, and event
              history.
            </p>
          </article>
          <article className="card">
            <h2>Operational resilience</h2>
            <p>Watchdog + command controls allow restart/lock/unlock flows when remote connectivity degrades.</p>
          </article>
        </section>

        <section className="steps">
          <h3>How it works</h3>
          <ol>
            <li>Install Anyattend on the connectee Windows laptop.</li>
            <li>Requester sends access request using AnyDesk IDs.</li>
            <li>Admin approves in PWA Incoming Requests.</li>
            <li>Approved IDs are synced into whitelist/ACL workflow.</li>
          </ol>
        </section>
      </main>

      <footer className="foot">
        <span>Anyattend</span>
        <span>Windows-first release</span>
      </footer>
    </div>
  );
}
