using System.Text.Json.Serialization;

namespace AnyattendAgent.Models;

public sealed class AgentConfig
{
    [JsonPropertyName("backend_url")]
    public string BackendUrl { get; set; } = "http://localhost:8080";
    [JsonPropertyName("device_id")]
    public string DeviceId { get; set; } = string.Empty;
    [JsonPropertyName("poll_interval_sec")]
    public int PollIntervalSec { get; set; } = 60;
    [JsonPropertyName("service_name")]
    public string ServiceName { get; set; } = "AnyDesk";
    [JsonPropertyName("webhook_fallback_url")]
    public string? WebhookFallbackUrl { get; set; }
    [JsonPropertyName("command_signing_secret")]
    public string CommandSigningSecret { get; set; } = string.Empty;
}
