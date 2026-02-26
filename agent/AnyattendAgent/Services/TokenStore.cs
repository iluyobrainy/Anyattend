using System.Security.Cryptography;
using System.Text;

namespace AnyattendAgent.Services;

public sealed class TokenStore
{
    private readonly string _tokenPath;

    public TokenStore()
    {
        var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        _tokenPath = Path.Combine(programData, "Anyattend", "device.token");
    }

    public void Save(string token)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_tokenPath)!);
        var raw = Encoding.UTF8.GetBytes(token);
        var protectedBytes = ProtectedData.Protect(raw, null, DataProtectionScope.LocalMachine);
        File.WriteAllBytes(_tokenPath, protectedBytes);
    }

    public string? Load()
    {
        if (!File.Exists(_tokenPath))
        {
            return null;
        }

        try
        {
            var encrypted = File.ReadAllBytes(_tokenPath);
            var plain = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.LocalMachine);
            return Encoding.UTF8.GetString(plain);
        }
        catch
        {
            return null;
        }
    }
}
