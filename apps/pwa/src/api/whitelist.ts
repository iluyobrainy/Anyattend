import { apiRequest } from "./client";

export interface WhitelistEntry {
  id: string;
  anydesk_id: string;
  normalized_anydesk_id: string;
  label?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RoleInfo {
  active_role: "admin" | "connectee";
  roles: Array<"admin" | "connectee">;
}

export async function fetchWhitelist(): Promise<WhitelistEntry[]> {
  const data = await apiRequest<{ entries: WhitelistEntry[] }>("/v2/whitelist");
  return data.entries;
}

export async function addWhitelistEntry(anydeskId: string, label: string): Promise<WhitelistEntry> {
  const data = await apiRequest<{ entry: WhitelistEntry }>("/v2/whitelist", {
    method: "POST",
    body: { anydesk_id: anydeskId, label }
  });
  return data.entry;
}

export async function deleteWhitelistEntry(entryId: string): Promise<void> {
  await apiRequest(`/v2/whitelist/${entryId}`, {
    method: "DELETE"
  });
}

export async function syncWhitelist(): Promise<{ entries_synced: number }> {
  return apiRequest("/v2/whitelist/sync", {
    method: "POST",
    body: {}
  });
}

export async function fetchRoles(): Promise<RoleInfo> {
  return apiRequest("/v2/me/roles");
}

export async function activateRole(role: "admin" | "connectee"): Promise<void> {
  await apiRequest("/v2/me/roles/activate", {
    method: "POST",
    body: { role }
  });
}
