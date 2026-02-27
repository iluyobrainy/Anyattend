using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var map = ParseArgs(args);
if (!map.TryGetValue("backend-url", out var backendUrl))
{
    PrintUsage();
    return;
}

var host = Environment.MachineName;
var label = map.TryGetValue("device-label", out var providedLabel) && !string.IsNullOrWhiteSpace(providedLabel)
    ? providedLabel.Trim()
    : host;

var payloadBase = new Dictionary<string, object?>
{
    ["host"] = host,
    ["device_label"] = label,
    ["poll_interval_sec"] = 60,
    ["service_name"] = "AnyDesk",
    ["webhook_fallback_url"] = null
};

string endpoint;

if (map.TryGetValue("pairing-session-id", out var pairingSessionId) &&
    map.TryGetValue("pairing-code", out var pairingCode))
{
    endpoint = "/v1/device/pair/complete";
    payloadBase["pairing_session_id"] = pairingSessionId;
    payloadBase["pairing_code"] = pairingCode;
}
else if (map.TryGetValue("anydesk-id", out var anydeskId) &&
         map.TryGetValue("ownership-code", out var ownershipCode))
{
    endpoint = "/v2/device/enroll";
    payloadBase["anydesk_id"] = anydeskId;
    payloadBase["verification_code"] = ownershipCode;
}
else
{
    PrintUsage();
    return;
}

using var httpClient = new HttpClient();
var body = new StringContent(JsonSerializer.Serialize(payloadBase), Encoding.UTF8, "application/json");
var response = await httpClient.PostAsync($"{backendUrl.TrimEnd('/')}{endpoint}", body);

if (!response.IsSuccessStatusCode)
{
    Console.Error.WriteLine($"Pairing failed: {(int)response.StatusCode}");
    Console.Error.WriteLine(await response.Content.ReadAsStringAsync());
    Environment.ExitCode = 1;
    return;
}

var raw = await response.Content.ReadAsStringAsync();
var pairResult = JsonSerializer.Deserialize<PairResponse>(raw, new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true
});

if (pairResult is null || string.IsNullOrWhiteSpace(pairResult.DeviceToken))
{
    Console.Error.WriteLine("Pairing response missing token.");
    Environment.ExitCode = 1;
    return;
}

var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
var baseDir = Path.Combine(programData, "Anyattend");
Directory.CreateDirectory(baseDir);

var configPath = Path.Combine(baseDir, "agent.json");
var tokenPath = Path.Combine(baseDir, "device.token");

var config = new
{
    backend_url = backendUrl,
    device_id = pairResult.DeviceId,
    poll_interval_sec = pairResult.PollIntervalSec,
    service_name = pairResult.ServiceName,
    webhook_fallback_url = pairResult.WebhookFallbackUrl,
    command_signing_secret = map.TryGetValue("command-signing-secret", out var commandSigningSecret) ? commandSigningSecret : string.Empty
};

await File.WriteAllTextAsync(configPath, JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true }));

var tokenBytes = Encoding.UTF8.GetBytes(pairResult.DeviceToken);
var protectedBytes = ProtectedData.Protect(tokenBytes, null, DataProtectionScope.LocalMachine);
await File.WriteAllBytesAsync(tokenPath, protectedBytes);

Console.WriteLine("Pairing complete.");
Console.WriteLine($"Config written: {configPath}");
Console.WriteLine("DPAPI token stored.");

static Dictionary<string, string> ParseArgs(string[] args)
{
    var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < args.Length - 1; i += 2)
    {
        var key = args[i].TrimStart('-');
        dict[key] = args[i + 1];
    }
    return dict;
}

static void PrintUsage()
{
    Console.WriteLine("Usage:");
    Console.WriteLine("AnyattendProvisioner --backend-url <url> [--device-label <name>] [--command-signing-secret <secret>]");
    Console.WriteLine("Mode A (v1): --pairing-session-id <uuid> --pairing-code <123456>");
    Console.WriteLine("Mode B (v1.1): --anydesk-id <806716144> --ownership-code <123456>");
}

file sealed class PairResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("device_id")]
    public string DeviceId { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonPropertyName("device_token")]
    public string DeviceToken { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonPropertyName("poll_interval_sec")]
    public int PollIntervalSec { get; set; } = 60;
    [System.Text.Json.Serialization.JsonPropertyName("service_name")]
    public string ServiceName { get; set; } = "AnyDesk";
    [System.Text.Json.Serialization.JsonPropertyName("webhook_fallback_url")]
    public string? WebhookFallbackUrl { get; set; }
}
