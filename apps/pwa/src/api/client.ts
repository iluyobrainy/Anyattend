const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export interface SessionState {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    email: string;
    role: "admin";
  };
}

function getSession(): SessionState | null {
  const raw = localStorage.getItem("anyattend_session");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    localStorage.removeItem("anyattend_session");
    return null;
  }
}

export function readSession(): SessionState | null {
  return getSession();
}

export function writeSession(session: SessionState | null): void {
  if (!session) {
    localStorage.removeItem("anyattend_session");
    return;
  }
  localStorage.setItem("anyattend_session", JSON.stringify(session));
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function refreshToken(session: SessionState): Promise<SessionState | null> {
  const response = await fetch(`${API_BASE}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refreshToken })
  });

  if (!response.ok) {
    writeSession(null);
    return null;
  }

  const data = await response.json();
  const updated: SessionState = {
    ...session,
    accessToken: data.access_token,
    refreshToken: data.refresh_token
  };
  writeSession(updated);
  return updated;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let session = getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options.auth !== false && session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const perform = async (): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

  let response = await perform();

  if (response.status === 401 && options.auth !== false && session) {
    session = await refreshToken(session);
    if (!session) {
      throw new Error("Session expired");
    }

    headers.Authorization = `Bearer ${session.accessToken}`;
    response = await perform();
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function login(email: string, password: string, totpCode: string): Promise<SessionState> {
  const result = await apiRequest<{
    access_token: string;
    refresh_token: string;
    admin: SessionState["admin"];
  }>("/v1/auth/login", {
    method: "POST",
    auth: false,
    body: {
      email,
      password,
      totp_code: totpCode
    }
  });

  const session: SessionState = {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    admin: result.admin
  };

  writeSession(session);
  return session;
}

export async function logout(): Promise<void> {
  const session = getSession();
  if (session) {
    await apiRequest("/v1/auth/logout", {
      method: "POST",
      body: { refresh_token: session.refreshToken }
    }).catch(() => undefined);
  }

  writeSession(null);
}

export async function registerPushSubscription(subscription: PushSubscription): Promise<void> {
  await apiRequest("/v1/auth/push/subscribe", {
    method: "POST",
    body: subscription.toJSON()
  });
}

export function getApiBase(): string {
  return API_BASE;
}
