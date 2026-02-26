import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDevices, type Device } from "../api/devices";

function statusClass(status: string): string {
  switch (status) {
    case "online":
      return "status-online";
    case "critical":
      return "status-critical";
    case "degraded":
      return "status-degraded";
    default:
      return "status-offline";
  }
}

export function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function loadDevices() {
    setLoading(true);
    setError("");
    try {
      const list = await fetchDevices();
      setDevices(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch devices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDevices();
    const timer = setInterval(() => {
      void loadDevices();
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section>
      <div className="section-header">
        <h2>Registered Devices</h2>
        <button type="button" className="ghost-btn" onClick={() => void loadDevices()}>
          Refresh
        </button>
      </div>

      {loading ? <p className="muted">Loading devices...</p> : null}
      {error ? <p className="error-msg">{error}</p> : null}

      <div className="device-grid">
        {devices.map((device) => (
          <button key={device.id} className="device-card" type="button" onClick={() => navigate(`/devices/${device.id}`)}>
            <div className="device-card-top">
              <h3>{device.label}</h3>
              <span className={`status-pill ${statusClass(device.status)}`}>{device.status}</span>
            </div>
            <p className="muted">Host: {device.host ?? "Unknown"}</p>
            <p className="muted">Service: {device.service_name}</p>
            <p className="muted">Last Seen: {device.last_seen ? new Date(device.last_seen).toLocaleString() : "Never"}</p>
          </button>
        ))}
      </div>

      {!loading && devices.length === 0 ? (
        <div className="empty-state">
          <h3>No devices paired yet</h3>
          <p>Open Pair Device to generate a QR session for the connectee laptop installer.</p>
        </div>
      ) : null}
    </section>
  );
}
