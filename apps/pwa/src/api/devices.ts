import { apiRequest } from "./client";

export interface Device {
  id: string;
  label: string;
  host?: string;
  status: string;
  last_seen?: string;
  poll_interval_sec: number;
  service_name: string;
  webhook_fallback_url?: string;
  created_at: string;
  paired_at?: string;
}

export interface DeviceEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function fetchDevices(): Promise<Device[]> {
  const data = await apiRequest<{ devices: Device[] }>("/v1/devices");
  return data.devices;
}

export async function fetchDevice(deviceId: string): Promise<{ device: Device; recent_commands: Array<Record<string, unknown>> }> {
  return apiRequest(`/v1/devices/${deviceId}`);
}

export async function fetchDeviceEvents(deviceId: string): Promise<DeviceEvent[]> {
  const data = await apiRequest<{ events: DeviceEvent[] }>(`/v1/devices/${deviceId}/events?limit=100`);
  return data.events;
}

export async function issueAction(deviceId: string, action: string): Promise<void> {
  await apiRequest(`/v1/devices/${deviceId}/actions`, {
    method: "POST",
    body: {
      action,
      payload: {}
    }
  });
}

export async function startPairing(deviceLabel: string): Promise<{
  pairing_session_id: string;
  pairing_code: string;
  expires_at: string;
  qr_payload: string;
}> {
  return apiRequest("/v1/devices/pairing/start", {
    method: "POST",
    body: { device_label: deviceLabel }
  });
}
