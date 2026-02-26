param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64"
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentProject = Join-Path $root "AnyattendAgent\AnyattendAgent.csproj"
$provisionerProject = Join-Path $root "AnyattendProvisioner\AnyattendProvisioner.csproj"
$outputRoot = Join-Path $root "publish"

$dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnetCmd -and (Test-Path "C:\Program Files\dotnet\dotnet.exe")) {
    $dotnetCmd = @{ Source = "C:\Program Files\dotnet\dotnet.exe" }
}
if (-not $dotnetCmd) {
    throw "dotnet SDK is required to build agent binaries."
}

& $dotnetCmd.Source publish $agentProject -c $Configuration -r $Runtime --self-contained false -o (Join-Path $outputRoot "AnyattendAgent")
if ($LASTEXITCODE -ne 0) { throw "Failed to build AnyattendAgent" }

& $dotnetCmd.Source publish $provisionerProject -c $Configuration -r $Runtime --self-contained false -o (Join-Path $outputRoot "AnyattendProvisioner")
if ($LASTEXITCODE -ne 0) { throw "Failed to build AnyattendProvisioner" }

Write-Output "Agent binaries published to: $outputRoot"
