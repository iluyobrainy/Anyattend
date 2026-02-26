[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "..\config\watchdog.config.json"),
    [switch]$OneShot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR")]
        [string]$Level = "INFO"
    )

    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Write-Output "[$timestamp][$Level] $Message"
}

function Get-ServiceById {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Identifier
    )

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

function Resolve-TargetService {
    param(
        [string]$ConfiguredName
    )

    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($ConfiguredName)) {
        $candidates += $ConfiguredName
    }
    $candidates += @("AnyDesk", "AnyDesk Service")

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        $service = Get-ServiceById -Identifier $candidate
        if ($null -ne $service) {
            return $service
        }
    }

    throw "Unable to resolve AnyDesk service. Checked: $($candidates -join ', ')"
}

function Send-Alert {
    param(
        [string]$WebhookUrl,
        [hashtable]$Payload
    )

    if ([string]::IsNullOrWhiteSpace($WebhookUrl)) {
        return
    }

    try {
        $body = $Payload | ConvertTo-Json -Depth 4
        Invoke-RestMethod -Method Post -Uri $WebhookUrl -ContentType "application/json" -Body $body | Out-Null
        Write-Log -Message "Alert sent to webhook."
    } catch {
        Write-Log -Level "WARN" -Message "Failed to send alert webhook: $($_.Exception.Message)"
    }
}

function Invoke-HealthCheck {
    param(
        [string]$ConfiguredServiceName,
        [string]$WebhookUrl
    )

    $hostName = $env:COMPUTERNAME
    $timestamp = (Get-Date).ToString("o")
    $service = $null

    try {
        $service = Resolve-TargetService -ConfiguredName $ConfiguredServiceName
    } catch {
        $payload = @{
            host         = $hostName
            timestamp    = $timestamp
            status       = "critical"
            action_taken = "service_not_found"
        }
        Send-Alert -WebhookUrl $WebhookUrl -Payload $payload
        Write-Log -Level "ERROR" -Message $_.Exception.Message
        return 2
    }

    if ($service.Status -eq "Running") {
        Write-Log -Message "Service '$($service.Name)' is healthy."
        return 0
    }

    Write-Log -Level "WARN" -Message "Service '$($service.Name)' is '$($service.Status)'. Attempting restart."
    try {
        Start-Service -Name $service.Name -ErrorAction Stop
        Start-Sleep -Seconds 5
        $service = Get-Service -Name $service.Name -ErrorAction Stop
    } catch {
        $payload = @{
            host         = $hostName
            timestamp    = $timestamp
            status       = "critical"
            action_taken = "restart_failed"
        }
        Send-Alert -WebhookUrl $WebhookUrl -Payload $payload
        Write-Log -Level "ERROR" -Message "Failed to restart service '$($service.Name)': $($_.Exception.Message)"
        return 2
    }

    if ($service.Status -eq "Running") {
        $payload = @{
            host         = $hostName
            timestamp    = $timestamp
            status       = "degraded"
            action_taken = "service_restarted"
        }
        Send-Alert -WebhookUrl $WebhookUrl -Payload $payload
        Write-Log -Level "WARN" -Message "Service '$($service.Name)' recovered by restart."
        return 1
    }

    $payload = @{
        host         = $hostName
        timestamp    = $timestamp
        status       = "critical"
        action_taken = "restart_failed"
    }
    Send-Alert -WebhookUrl $WebhookUrl -Payload $payload
    Write-Log -Level "ERROR" -Message "Service '$($service.Name)' is still not running after restart attempt."
    return 2
}

if (-not (Test-Path -Path $ConfigPath -PathType Leaf)) {
    throw "Config file not found: $ConfigPath"
}

$config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($config.service_name)) {
    throw "Config key 'service_name' is required."
}

$intervalSec = [int]$config.check_interval_sec
if ($intervalSec -lt 5) {
    throw "Config key 'check_interval_sec' must be >= 5."
}

$webhookUrl = [string]$config.alert_webhook_url

if ($OneShot) {
    $code = Invoke-HealthCheck -ConfiguredServiceName $config.service_name -WebhookUrl $webhookUrl
    exit $code
}

Write-Log -Message "Starting watchdog loop. Interval=$intervalSec sec, Config='$ConfigPath'"
while ($true) {
    [void](Invoke-HealthCheck -ConfiguredServiceName $config.service_name -WebhookUrl $webhookUrl)
    Start-Sleep -Seconds $intervalSec
}
