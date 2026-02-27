import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  getApiBase,
  logout,
  patchSessionAdmin,
  readSession,
  registerPushSubscription,
  writeSession,
  type SessionState
} from "./api/client";
import { activateRole, fetchRoles } from "./api/whitelist";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DevicePage } from "./pages/DevicePage";
import { IncomingRequestsPage } from "./pages/IncomingRequestsPage";
import { PairingPage } from "./pages/PairingPage";
import { WhitelistPage } from "./pages/WhitelistPage";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

function toUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function enablePushIfPossible(): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return;
  }

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource
    });
  }

  await registerPushSubscription(subscription);
}

function AuthenticatedLayout({
  session,
  onSessionUpdate,
  onLogout
}: {
  session: SessionState;
  onSessionUpdate: (session: SessionState) => void;
  onLogout: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [roleBusy, setRoleBusy] = useState(false);

  const title = useMemo(() => {
    if (location.pathname.startsWith("/pair")) {
      return "Pair New Device";
    }
    if (location.pathname.startsWith("/devices/")) {
      return "Device Details";
    }
    if (location.pathname.startsWith("/whitelist")) {
      return "Whitelist";
    }
    if (location.pathname.startsWith("/requests")) {
      return "Incoming Requests";
    }
    return "Operations Console";
  }, [location.pathname]);

  useEffect(() => {
    fetchRoles()
      .then((roles) => {
        const next = patchSessionAdmin({ active_role: roles.active_role });
        if (next) {
          onSessionUpdate(next);
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="brand-tag">Anyattend v1.2</p>
          <h1>{title}</h1>
          <p className="muted">{session.admin.anydesk_id}</p>
        </div>
        <div className="topbar-actions">
          <label className="role-switch">
            Role
            <select
              value={session.admin.active_role}
              disabled={roleBusy}
              onChange={async (e) => {
                const role = e.target.value as "admin" | "connectee";
                setRoleBusy(true);
                try {
                  await activateRole(role);
                  const next = patchSessionAdmin({ active_role: role });
                  if (next) {
                    onSessionUpdate(next);
                  }
                } finally {
                  setRoleBusy(false);
                }
              }}
            >
              <option value="admin">admin</option>
              <option value="connectee">connectee</option>
            </select>
          </label>
          <button onClick={() => navigate("/")} className="ghost-btn" type="button">
            Dashboard
          </button>
          <button onClick={() => navigate("/whitelist")} className="ghost-btn" type="button">
            Whitelist
          </button>
          <button onClick={() => navigate("/requests")} className="ghost-btn" type="button">
            Requests
          </button>
          <button onClick={() => navigate("/pair")} className="ghost-btn" type="button">
            Pair Device
          </button>
          <button onClick={() => onLogout()} className="danger-btn" type="button">
            Sign Out
          </button>
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/whitelist" element={<WhitelistPage />} />
          <Route path="/requests" element={<IncomingRequestsPage />} />
          <Route path="/pair" element={<PairingPage />} />
          <Route path="/devices/:deviceId" element={<DevicePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer-note">API: {getApiBase()}</footer>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<SessionState | null>(() => readSession());

  useEffect(() => {
    if (session) {
      enablePushIfPossible().catch(() => undefined);
    }
  }, [session]);

  if (!session) {
    return (
      <LoginPage
        onLogin={(nextSession) => {
          writeSession(nextSession);
          setSession(nextSession);
        }}
      />
    );
  }

  return (
    <AuthenticatedLayout
      session={session}
      onSessionUpdate={(next) => setSession(next)}
      onLogout={async () => {
        await logout();
        setSession(null);
      }}
    />
  );
}
