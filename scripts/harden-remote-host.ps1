[CmdletBinding()]
param(
    [string]$PreferredServiceName = "AnyDesk"
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

function Assert-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this script in an elevated PowerShell session."
    }
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

function Resolve-TargetService {
    param([string]$ConfiguredName)

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

Assert-Admin

Write-Log -Message "Applying power policy hardening."
& powercfg /change standby-timeout-ac 0 | Out-Null
& powercfg /change hibernate-timeout-ac 0 | Out-Null
& powercfg /hibernate off | Out-Null

Write-Log -Message "Applying NIC power management hardening."
if (Get-Command -Name Set-NetAdapterPowerManagement -ErrorAction SilentlyContinue) {
    $adapters = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne "Disabled" }
    foreach ($adapter in $adapters) {
        try {
            Set-NetAdapterPowerManagement -Name $adapter.Name -AllowComputerToTurnOffDevice Disabled -ErrorAction Stop
            Write-Log -Message "Disabled power-off for adapter '$($adapter.Name)'."
        } catch {
            Write-Log -Level "WARN" -Message "Could not modify adapter '$($adapter.Name)': $($_.Exception.Message)"
        }
    }
} else {
    Write-Log -Level "WARN" -Message "Set-NetAdapterPowerManagement is unavailable on this host. Apply NIC power settings manually."
}

$service = Resolve-TargetService -ConfiguredName $PreferredServiceName
Write-Log -Message "Configuring service '$($service.Name)' startup to Automatic."
Set-Service -Name $service.Name -StartupType Automatic

$service = Get-Service -Name $service.Name
if ($service.Status -ne "Running") {
    Write-Log -Message "Starting service '$($service.Name)'."
    Start-Service -Name $service.Name
}

Write-Log -Message "Host hardening complete."
