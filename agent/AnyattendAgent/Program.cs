using AnyattendAgent.Services;

IHost host = Host.CreateDefaultBuilder(args)
    .UseWindowsService(options => { options.ServiceName = "AnyattendAgent"; })
    .ConfigureServices(services =>
    {
        services.AddHttpClient();
        services.AddSingleton<AgentConfigProvider>();
        services.AddSingleton<TokenStore>();
        services.AddSingleton<AnyattendApiClient>();
        services.AddSingleton<CommandExecutor>();
        services.AddHostedService<AgentWorker>();
    })
    .Build();

await host.RunAsync();
