[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "..\config\watchdog.config.json"),
    [string]$TaskName = "AnyDeskWatchdog"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Check {
    param(
        [bool]$Passed,
        [string]$Name,
        [string]$Details
    )

    $status = if ($Passed) { "PASS" } else { "FAIL" }
    Write-Output "[$status] $Name - $Details"
}

function Get-ServiceById {
    param([string]$Identifier)

    try {
        return Get-Service -Name $Identifier -ErrorAction Stop
    } catch {
        $match = Get-Service | Where-Object { $_.DisplayName -eq $Identifier } | Select-Object -First 1
        if ($null -ne $match) {
            return $match
        }
    }

    return $null
}

$allPassed = $true

if (-not (Test-Path -Path $ConfigPath -PathType Leaf)) {
    Write-Check -Passed $false -Name "Config file" -Details "Missing: $ConfigPath"
    exit 1
}

$config = $null
try {
    $config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
    Write-Check -Passed $true -Name "Config parse" -Details "JSON parsed successfully."
} catch {
    Write-Check -Passed $false -Name "Config parse" -Details $_.Exception.Message
    exit 1
}

$service = Get-ServiceById -Identifier $config.service_name
if ($null -eq $service) {
    Write-Check -Passed $false -Name "AnyDesk service" -Details "Not found for '$($config.service_name)'."
    $allPassed = $false
} else {
    Write-Check -Passed $true -Name "AnyDesk service" -Details "Resolved as '$($service.Name)'."
    Write-Check -Passed ($service.Status -eq "Running") -Name "Service status" -Details "Current status: $($service.Status)"
    if ($service.Status -ne "Running") {
        $allPassed = $false
    }

    $serviceInfo = Get-CimInstance -ClassName Win32_Service -Filter ("Name='{0}'" -f $service.Name)
    $isAuto = ($serviceInfo.StartMode -eq "Auto")
    Write-Check -Passed $isAuto -Name "Service startup type" -Details "StartMode: $($serviceInfo.StartMode)"
    if (-not $isAuto) {
        $allPassed = $false
    }
}

try {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    $state = $task.State
    $enabled = $task.Settings.Enabled
    $taskPassed = $enabled
    Write-Check -Passed $taskPassed -Name "Scheduled task" -Details "State: $state, Enabled: $enabled"
    if (-not $taskPassed) {
        $allPassed = $false
    }
} catch {
    Write-Check -Passed $false -Name "Scheduled task" -Details "Task '$TaskName' not found."
    $allPassed = $false
}

if ($allPassed) {
    Write-Output "Validation successful."
    exit 0
}

Write-Output "Validation failed. Resolve failed checks and re-run."
exit 1
