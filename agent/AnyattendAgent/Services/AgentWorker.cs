using AnyattendAgent.Models;
using AnyattendAgent.Utilities;

namespace AnyattendAgent.Services;

public sealed class AgentWorker : BackgroundService
{
    private readonly ILogger<AgentWorker> _logger;
    private readonly AgentConfigProvider _configProvider;
    private readonly TokenStore _tokenStore;
    private readonly AnyattendApiClient _apiClient;
    private readonly CommandExecutor _commandExecutor;

    public AgentWorker(
        ILogger<AgentWorker> logger,
        AgentConfigProvider configProvider,
        TokenStore tokenStore,
        AnyattendApiClient apiClient,
        CommandExecutor commandExecutor)
    {
        _logger = logger;
        _configProvider = configProvider;
        _tokenStore = tokenStore;
        _apiClient = apiClient;
        _commandExecutor = commandExecutor;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("AnyattendAgent starting.");

        AgentConfig config;
        try
        {
            config = _configProvider.Load();
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Failed to load config. Service will stop.");
            return;
        }

        var deviceToken = _tokenStore.Load();
        if (string.IsNullOrWhiteSpace(deviceToken))
        {
            _logger.LogCritical("No DPAPI token found. Run AnyattendProvisioner to complete pairing.");
            return;
        }

        DateTimeOffset? since = null;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _apiClient.SendHeartbeatAsync(
                    config,
                    deviceToken,
                    "online",
                    new Dictionary<string, object?>
                    {
                        ["agent"] = "AnyattendAgent",
                        ["version"] = "1.0.0"
                    },
                    stoppingToken);

                var commands = await _apiClient.GetCommandsAsync(config, deviceToken, since, stoppingToken);

                foreach (var command in commands)
                {
                    if (CommandVerifier.IsExpired(command))
                    {
                        await _apiClient.AckCommandAsync(config, deviceToken, command.Id, "failed", "Command expired", stoppingToken);
                        continue;
                    }

                    if (string.IsNullOrWhiteSpace(config.CommandSigningSecret))
                    {
                        _logger.LogWarning("Command signing secret is missing in config; signature validation skipped.");
                    }
                    else if (!CommandVerifier.IsSignatureValid(command, config.DeviceId, config.CommandSigningSecret))
                    {
                        await _apiClient.AckCommandAsync(config, deviceToken, command.Id, "failed", "Invalid command signature", stoppingToken);
                        continue;
                    }

                    var (ok, message) = await _commandExecutor.ExecuteAsync(config, command, stoppingToken);
                    await _apiClient.AckCommandAsync(config, deviceToken, command.Id, ok ? "success" : "failed", message, stoppingToken);
                    since = DateTimeOffset.UtcNow;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Agent loop failure");
                try
                {
                    await _apiClient.SendAlertAsync(
                        config,
                        deviceToken,
                        "critical",
                        "agent_loop_failure",
                        new Dictionary<string, object?> { ["error"] = ex.Message },
                        stoppingToken);
                }
                catch
                {
                    // Keep loop alive.
                }
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(config.PollIntervalSec), stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("AnyattendAgent stopped.");
    }
}
