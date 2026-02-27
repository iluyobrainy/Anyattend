const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export interface SessionState {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    identity_id: string;
    anydesk_id: string;
    role: "admin";
    active_role: "admin" | "connectee";
  };
}

export interface ChallengeStartResponse {
  challenge_id: string;
  expires_at: string;
  linked_device_id: string | null;
  anydesk_id: string;
  delivery: {
    method: string;
    note: string;
  };
  development_verification_code?: string;
}

function parseErrorText(text: string): string {
  if (!text) {
    return "Request failed.";
  }

  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) {
      return parsed.error;
    }
  } catch {
    // Ignore parse errors and fall through to raw text.
  }

  return text;
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
  const response = await fetch(`${API_BASE}/v2/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refreshToken })
  });

  if (!response.ok) {
    writeSession(null);
    return null;
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    admin: SessionState["admin"];
  };

  const updated: SessionState = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    admin: data.admin
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
    throw new Error(parseErrorText(text) || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function startAdminAuth(anydeskId: string): Promise<ChallengeStartResponse> {
  return apiRequest<ChallengeStartResponse>("/v2/auth/admin/start", {
    method: "POST",
    auth: false,
    body: { anydesk_id: anydeskId }
  });
}

export async function verifyAdminAuth(challengeId: string, verificationCode: string): Promise<SessionState> {
  const result = await apiRequest<{
    access_token: string;
    refresh_token: string;
    admin: SessionState["admin"];
  }>("/v2/auth/admin/verify", {
    method: "POST",
    auth: false,
    body: {
      challenge_id: challengeId,
      verification_code: verificationCode
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
    await apiRequest("/v2/auth/logout", {
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

export function patchSessionAdmin(patch: Partial<SessionState["admin"]>): SessionState | null {
  const current = getSession();
  if (!current) {
    return null;
  }

  const next: SessionState = {
    ...current,
    admin: {
      ...current.admin,
      ...patch
    }
  };
  writeSession(next);
  return next;
}

export function getApiBase(): string {
  return API_BASE;
}
