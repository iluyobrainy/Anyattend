using System.Text.Json;
using AnyattendAgent.Models;

namespace AnyattendAgent.Services;

public sealed class AgentConfigProvider
{
    private readonly string _configPath;

    public AgentConfigProvider()
    {
        var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        _configPath = Path.Combine(programData, "Anyattend", "agent.json");
    }

    public string ConfigPath => _configPath;

    public AgentConfig Load()
    {
        if (!File.Exists(_configPath))
        {
            throw new FileNotFoundException($"Config file not found: {_configPath}");
        }

        var json = File.ReadAllText(_configPath);
        var config = JsonSerializer.Deserialize<AgentConfig>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (config is null)
        {
            throw new InvalidOperationException("Failed to parse agent config");
        }

        config.PollIntervalSec = Math.Clamp(config.PollIntervalSec, 10, 300);
        return config;
    }
}
