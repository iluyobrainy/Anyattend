using System.Diagnostics;
using System.ServiceProcess;
using AnyattendAgent.Models;

namespace AnyattendAgent.Services;

public sealed class CommandExecutor
{
    private readonly ILogger<CommandExecutor> _logger;

    public CommandExecutor(ILogger<CommandExecutor> logger)
    {
        _logger = logger;
    }

    public async Task<(bool Ok, string Message)> ExecuteAsync(AgentConfig config, CommandEnvelope command, CancellationToken ct)
    {
        return command.Type switch
        {
            "RUN_VALIDATION" => await RunValidationAsync(ct),
            "RESTART_ANYDESK_SERVICE" => await RestartServiceAsync(config.ServiceName, ct),
            "LOCK_REMOTE" => await StopServiceAsync(config.ServiceName, ct),
            "UNLOCK_REMOTE" => await StartServiceAsync(config.ServiceName, ct),
            "REFRESH_STATUS" => (true, "Status refresh requested"),
            _ => (false, $"Unsupported command type: {command.Type}")
        };
    }

    private async Task<(bool Ok, string Message)> RunValidationAsync(CancellationToken ct)
    {
        var scriptPath = @"C:\Program Files\Anyattend\scripts\validate-setup.ps1";
        if (!File.Exists(scriptPath))
        {
            return (false, $"Validation script not found: {scriptPath}");
        }

        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi);
        if (process is null)
        {
            return (false, "Failed to start validation process");
        }

        await process.WaitForExitAsync(ct);
        var output = await process.StandardOutput.ReadToEndAsync(ct);
        var error = await process.StandardError.ReadToEndAsync(ct);

        if (process.ExitCode == 0)
        {
            return (true, string.IsNullOrWhiteSpace(output) ? "Validation passed" : output.Trim());
        }

        var combined = string.Join(" | ", new[] { output.Trim(), error.Trim() }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return (false, combined.Length > 350 ? combined[..350] : combined);
    }

    private async Task<(bool Ok, string Message)> RestartServiceAsync(string configuredName, CancellationToken ct)
    {
        var serviceName = ResolveServiceName(configuredName);
        if (serviceName is null)
        {
            return (false, "AnyDesk service not found");
        }

        using var service = new ServiceController(serviceName);
        try
        {
            if (service.Status != ServiceControllerStatus.Stopped)
            {
                service.Stop();
                service.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(20));
            }

            service.Start();
            service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(20));
            return (true, $"Service {serviceName} restarted");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Restart service failed");
            return (false, ex.Message);
        }
    }

    private async Task<(bool Ok, string Message)> StopServiceAsync(string configuredName, CancellationToken ct)
    {
        var serviceName = ResolveServiceName(configuredName);
        if (serviceName is null)
        {
            return (false, "AnyDesk service not found");
        }

        using var service = new ServiceController(serviceName);
        try
        {
            if (service.Status != ServiceControllerStatus.Stopped)
            {
                service.Stop();
                service.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(20));
            }

            return (true, $"Service {serviceName} stopped");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Stop service failed");
            return (false, ex.Message);
        }
    }

    private async Task<(bool Ok, string Message)> StartServiceAsync(string configuredName, CancellationToken ct)
    {
        var serviceName = ResolveServiceName(configuredName);
        if (serviceName is null)
        {
            return (false, "AnyDesk service not found");
        }

        using var service = new ServiceController(serviceName);
        try
        {
            if (service.Status != ServiceControllerStatus.Running)
            {
                service.Start();
                service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(20));
            }

            return (true, $"Service {serviceName} started");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Start service failed");
            return (false, ex.Message);
        }
    }

    private static string? ResolveServiceName(string configuredName)
    {
        var candidates = new[]
        {
            configuredName,
            "AnyDesk",
            "AnyDesk Service"
        }.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct();

        foreach (var candidate in candidates)
        {
            var service = ServiceController.GetServices().FirstOrDefault(s =>
                string.Equals(s.ServiceName, candidate, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.DisplayName, candidate, StringComparison.OrdinalIgnoreCase));

            if (service is not null)
            {
                return service.ServiceName;
            }
        }

        return null;
    }
}
