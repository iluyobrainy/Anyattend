[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "..\config\watchdog.config.json"),
    [string]$ScriptPath = (Join-Path $PSScriptRoot "watchdog.ps1"),
    [string]$TaskName = "AnyDeskWatchdog"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this script in an elevated PowerShell session."
    }
}

Assert-Admin

if (-not (Test-Path -Path $ConfigPath -PathType Leaf)) {
    throw "Config file not found: $ConfigPath"
}
if (-not (Test-Path -Path $ScriptPath -PathType Leaf)) {
    throw "Watchdog script not found: $ScriptPath"
}

$config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
$intervalSec = [int]$config.check_interval_sec
if ($intervalSec -lt 5) {
    throw "Config key 'check_interval_sec' must be >= 5."
}
$intervalMin = [Math]::Max([int][Math]::Ceiling($intervalSec / 60.0), 1)

$escapedScriptPath = $ScriptPath.Replace('"', '\"')
$escapedConfigPath = $ConfigPath.Replace('"', '\"')
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$escapedScriptPath`" -ConfigPath `"$escapedConfigPath`" -OneShot"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments

$startupTrigger = New-ScheduledTaskTrigger -AtStartup
$repeatTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1)
$repeatTrigger.RepetitionInterval = [TimeSpan]::FromMinutes($intervalMin)
$repeatTrigger.RepetitionDuration = [TimeSpan]::FromDays(3650)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($startupTrigger, $repeatTrigger) `
    -Settings $settings `
    -User "SYSTEM" `
    -RunLevel Highest `
    -Force | Out-Null

Write-Output "Scheduled task '$TaskName' installed/updated."
Write-Output "Watchdog cadence: every $intervalMin minute(s)."
