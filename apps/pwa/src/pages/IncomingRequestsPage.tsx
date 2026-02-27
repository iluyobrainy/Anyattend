import { useEffect, useState } from "react";
import { decideIncomingRequest, fetchIncomingRequests, type IncomingRequest } from "../api/requests";

export function IncomingRequestsPage() {
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"pending" | "all">("pending");

  async function loadRequests(nextView: "pending" | "all" = view) {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchIncomingRequests(nextView);
      setRequests(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incoming requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests(view);
    const timer = setInterval(() => void loadRequests(view), 10000);
    return () => clearInterval(timer);
  }, [view]);

  return (
    <section className="device-detail">
      <div className="detail-card">
        <div className="section-header">
          <h2>Incoming Requests</h2>
          <div className="button-row">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setView(view === "pending" ? "all" : "pending")}
              disabled={loading}
            >
              View: {view === "pending" ? "Pending" : "All"}
            </button>
            <button type="button" className="ghost-btn" onClick={() => void loadRequests()} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
        <p className="muted">Approve to auto-add requester ID to whitelist and trigger ACL sync event.</p>
      </div>

      {loading ? <p className="muted">Loading requests...</p> : null}
      {error ? <p className="error-msg">{error}</p> : null}

      <div className="event-list">
        {requests.map((request) => (
          <article key={request.id} className="event-item">
            <header>
              <strong>{request.requester_anydesk_id}</strong>
              <span>{request.status}</span>
            </header>
            <p className="muted">
              Requested: {new Date(request.requested_at).toLocaleString()} | Expires:{" "}
              {new Date(request.expires_at).toLocaleString()}
            </p>
            {request.requester_label ? <p className="muted">Label: {request.requester_label}</p> : null}
            {request.note ? <p className="muted">Note: {request.note}</p> : null}
            {request.status === "pending" ? (
              <div className="button-row">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={Boolean(busyId)}
                  onClick={async () => {
                    setBusyId(request.id);
                    setError("");
                    try {
                      await decideIncomingRequest(request.id, "approve");
                      await loadRequests();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to approve request.");
                    } finally {
                      setBusyId("");
                    }
                  }}
                >
                  {busyId === request.id ? "Working..." : "Approve"}
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  disabled={Boolean(busyId)}
                  onClick={async () => {
                    setBusyId(request.id);
                    setError("");
                    try {
                      await decideIncomingRequest(request.id, "decline");
                      await loadRequests();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to decline request.");
                    } finally {
                      setBusyId("");
                    }
                  }}
                >
                  {busyId === request.id ? "Working..." : "Decline"}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {!loading && requests.length === 0 ? (
        <div className="empty-state">
          <h3>No requests</h3>
          <p>Incoming requester approvals will appear here.</p>
        </div>
      ) : null}
    </section>
  );
}
