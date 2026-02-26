import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchDevice, fetchDeviceEvents, issueAction, type Device, type DeviceEvent } from "../api/devices";

const actions = [
  "RUN_VALIDATION",
  "RESTART_ANYDESK_SERVICE",
  "LOCK_REMOTE",
  "UNLOCK_REMOTE",
  "REFRESH_STATUS"
] as const;

export function DevicePage() {
  const { deviceId } = useParams();
  const [device, setDevice] = useState<Device | null>(null);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [busyAction, setBusyAction] = useState<string>("");
  const [error, setError] = useState("");

  async function loadAll() {
    if (!deviceId) {
      return;
    }

    setError("");
    try {
      const [details, timeline] = await Promise.all([fetchDevice(deviceId), fetchDeviceEvents(deviceId)]);
      setDevice(details.device);
      setEvents(timeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load device.");
    }
  }

  useEffect(() => {
    void loadAll();
    const timer = setInterval(() => void loadAll(), 12000);
    return () => clearInterval(timer);
  }, [deviceId]);

  if (!deviceId) {
    return <p className="error-msg">Device ID missing.</p>;
  }

  return (
    <section className="device-detail">
      {error ? <p className="error-msg">{error}</p> : null}

      <div className="detail-card">
        <h2>{device?.label ?? "Loading..."}</h2>
        <p className="muted">Device ID: {deviceId}</p>
        <p className="muted">Host: {device?.host ?? "Unknown"}</p>
        <p className="muted">Status: {device?.status ?? "Unknown"}</p>
        <p className="muted">Last Seen: {device?.last_seen ? new Date(device.last_seen).toLocaleString() : "Never"}</p>
      </div>

      <div className="detail-card">
        <h3>Remote Actions</h3>
        <div className="action-row">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className="primary-btn"
              disabled={busyAction.length > 0}
              onClick={async () => {
                setBusyAction(action);
                setError("");
                try {
                  await issueAction(deviceId, action);
                  await loadAll();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Action failed.");
                } finally {
                  setBusyAction("");
                }
              }}
            >
              {busyAction === action ? "Sending..." : action}
            </button>
          ))}
        </div>
      </div>

      <div className="detail-card">
        <h3>Events</h3>
        <div className="event-list">
          {events.map((event) => (
            <article key={event.id} className="event-item">
              <header>
                <strong>{event.event_type}</strong>
                <span>{new Date(event.created_at).toLocaleString()}</span>
              </header>
              <pre>{JSON.stringify(event.payload, null, 2)}</pre>
            </article>
          ))}
          {events.length === 0 ? <p className="muted">No events yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
