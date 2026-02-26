using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AnyattendAgent.Models;

namespace AnyattendAgent.Services;

public sealed class AnyattendApiClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AnyattendApiClient> _logger;

    public AnyattendApiClient(IHttpClientFactory httpClientFactory, ILogger<AnyattendApiClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task SendHeartbeatAsync(AgentConfig config, string deviceToken, string status, Dictionary<string, object?> details, CancellationToken ct)
    {
        var payload = new
        {
            host = Environment.MachineName,
            status,
            details
        };

        using var request = BuildRequest(config, deviceToken, HttpMethod.Post, "/v1/device/heartbeat", payload);
        await SendAsync(request, ct);
    }

    public async Task SendAlertAsync(AgentConfig config, string deviceToken, string status, string actionTaken, Dictionary<string, object?> details, CancellationToken ct)
    {
        var payload = new
        {
            host = Environment.MachineName,
            timestamp = DateTime.UtcNow.ToString("O"),
            status,
            action_taken = actionTaken,
            details
        };

        using var request = BuildRequest(config, deviceToken, HttpMethod.Post, "/v1/device/alerts", payload);
        await SendAsync(request, ct);
    }

    public async Task<List<CommandEnvelope>> GetCommandsAsync(AgentConfig config, string deviceToken, DateTimeOffset? since, CancellationToken ct)
    {
        var suffix = since.HasValue ? $"?since={Uri.EscapeDataString(since.Value.UtcDateTime.ToString("O"))}" : string.Empty;
        using var request = BuildRequest(config, deviceToken, HttpMethod.Get, $"/v1/device/commands{suffix}", null);
        var body = await SendAsync(request, ct);

        var parsed = JsonSerializer.Deserialize<CommandListResponse>(body, JsonOptions());
        return parsed?.Commands ?? new List<CommandEnvelope>();
    }

    public async Task AckCommandAsync(AgentConfig config, string deviceToken, string commandId, string ackStatus, string ackMessage, CancellationToken ct)
    {
        var payload = new
        {
            ack_status = ackStatus,
            ack_message = ackMessage
        };

        using var request = BuildRequest(config, deviceToken, HttpMethod.Post, $"/v1/device/commands/{commandId}/ack", payload);
        await SendAsync(request, ct);
    }

    private HttpRequestMessage BuildRequest(AgentConfig config, string token, HttpMethod method, string path, object? payload)
    {
        var baseUrl = config.BackendUrl.TrimEnd('/');
        var request = new HttpRequestMessage(method, baseUrl + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        if (payload is not null)
        {
            var json = JsonSerializer.Serialize(payload, JsonOptions());
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return request;
    }

    private async Task<string> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("anyattend");
        using var response = await client.SendAsync(request, ct);

        if (!response.IsSuccessStatusCode)
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Anyattend API call failed {Status}: {Body}", response.StatusCode, text);
            throw new HttpRequestException($"Anyattend API request failed: {(int)response.StatusCode}");
        }

        return await response.Content.ReadAsStringAsync(ct);
    }

    private static JsonSerializerOptions JsonOptions() => new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };
}
