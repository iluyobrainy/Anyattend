using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AnyattendAgent.Models;

namespace AnyattendAgent.Utilities;

public static class CommandVerifier
{
    public static bool IsExpired(CommandEnvelope command)
    {
        if (!DateTimeOffset.TryParse(command.ExpiresAt, out var expiresAt))
        {
            return true;
        }
        return expiresAt <= DateTimeOffset.UtcNow;
    }

    public static bool IsSignatureValid(CommandEnvelope command, string deviceId, string secret)
    {
        if (string.IsNullOrWhiteSpace(secret))
        {
            return false;
        }

        var canonical = JsonSerializer.Serialize(new
        {
            id = command.Id,
            device_id = deviceId,
            type = command.Type,
            payload = command.Payload,
            nonce = command.Nonce,
            expires_at = command.ExpiresAt
        });

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(canonical));
        var hex = Convert.ToHexString(hash).ToLowerInvariant();
        return string.Equals(hex, command.Signature, StringComparison.OrdinalIgnoreCase);
    }
}
