using System.Text.Json.Serialization;

namespace AnyattendAgent.Models;

public sealed class CommandEnvelope
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("payload")]
    public Dictionary<string, object?> Payload { get; set; } = new();

    [JsonPropertyName("nonce")]
    public string Nonce { get; set; } = string.Empty;

    [JsonPropertyName("expires_at")]
    public string ExpiresAt { get; set; } = string.Empty;

    [JsonPropertyName("signature")]
    public string Signature { get; set; } = string.Empty;
}

public sealed class CommandListResponse
{
    [JsonPropertyName("commands")]
    public List<CommandEnvelope> Commands { get; set; } = new();
}
