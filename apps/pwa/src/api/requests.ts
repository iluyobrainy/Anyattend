import { apiRequest } from "./client";

export interface IncomingRequest {
  id: string;
  requester_anydesk_id: string;
  requester_normalized_anydesk_id: string;
  requester_label?: string | null;
  note?: string | null;
  status: "pending" | "approved" | "declined" | "expired";
  requested_at: string;
  expires_at: string;
  decided_at?: string | null;
  decision_note?: string | null;
}

export async function fetchIncomingRequests(status: "pending" | "all" = "pending"): Promise<IncomingRequest[]> {
  const data = await apiRequest<{ requests: IncomingRequest[] }>(`/v2/requests?status=${status}`);
  return data.requests;
}

export async function decideIncomingRequest(
  requestId: string,
  decision: "approve" | "decline",
  decisionNote = ""
): Promise<void> {
  await apiRequest(`/v2/requests/${requestId}/decision`, {
    method: "POST",
    body: {
      decision,
      decision_note: decisionNote
    }
  });
}

export async function submitIncomingRequest(
  ownerAnydeskId: string,
  requesterAnydeskId: string,
  requesterLabel: string,
  note: string
): Promise<{ request_id?: string; status: string; message?: string; expires_at?: string }> {
  return apiRequest("/v2/public/requests", {
    method: "POST",
    auth: false,
    body: {
      owner_anydesk_id: ownerAnydeskId,
      requester_anydesk_id: requesterAnydeskId,
      requester_label: requesterLabel,
      note
    }
  });
}
