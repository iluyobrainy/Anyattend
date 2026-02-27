import { useEffect, useState } from "react";
import { addWhitelistEntry, deleteWhitelistEntry, fetchWhitelist, syncWhitelist, type WhitelistEntry } from "../api/whitelist";
import { normalizeAnyDeskIdInput, validateAnyDeskId } from "../utils/anydeskId";

export function WhitelistPage() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [anydeskId, setAnydeskId] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadEntries() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchWhitelist();
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load whitelist.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  return (
    <section className="device-detail">
      <div className="detail-card">
        <h2>Requester Whitelist</h2>
        <p className="muted">Only listed AnyDesk IDs should be allowed as trusted requesters.</p>
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const validationError = validateAnyDeskId(anydeskId);
              if (validationError) {
                throw new Error(validationError);
              }

              const { normalized } = normalizeAnyDeskIdInput(anydeskId);
              await addWhitelistEntry(normalized, label.trim());
              setAnydeskId("");
              setLabel("");
              setMessage("Requester added to whitelist.");
              await loadEntries();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to add whitelist entry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Requester AnyDesk ID
            <input
              value={anydeskId}
              onChange={(e) => setAnydeskId(normalizeAnyDeskIdInput(e.target.value).display)}
              inputMode="numeric"
              placeholder="806 716 144"
              required
            />
            <span className="input-hint">Spacing is optional; digits are normalized automatically.</span>
          </label>
          <label>
            Label (optional)
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Main Workstation" maxLength={80} />
          </label>
          {error ? <p className="error-msg">{error}</p> : null}
          {message ? <p className="success-msg">{message}</p> : null}
          <div className="button-row">
            <button className="primary-btn" type="submit" disabled={busy}>
              {busy ? "Saving..." : "Add ID"}
            </button>
            <button
              className="ghost-btn"
              type="button"
              disabled={busy || loading}
              onClick={async () => {
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  const result = await syncWhitelist();
                  setMessage(`ACL sync queued. Entries synced: ${result.entries_synced}.`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Whitelist sync failed.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sync ACL
            </button>
          </div>
        </form>
      </div>

      <div className="detail-card">
        <h3>Active Entries</h3>
        {loading ? <p className="muted">Loading whitelist...</p> : null}
        {!loading && entries.length === 0 ? <p className="muted">No requester IDs added yet.</p> : null}
        <div className="event-list">
          {entries.map((entry) => (
            <article key={entry.id} className="event-item">
              <header>
                <strong>{entry.anydesk_id}</strong>
                <span>{new Date(entry.updated_at).toLocaleString()}</span>
              </header>
              <p className="muted">{entry.label || "No label"}</p>
              <div className="button-row">
                <button
                  type="button"
                  className="danger-btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    setMessage("");
                    try {
                      await deleteWhitelistEntry(entry.id);
                      setMessage(`Removed ${entry.anydesk_id} from whitelist.`);
                      await loadEntries();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to remove entry.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
