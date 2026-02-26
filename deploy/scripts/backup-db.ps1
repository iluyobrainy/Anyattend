param(
    [string]$OutputDir = "./backups"
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) {
    throw "Missing deploy/.env file"
}

$envData = Get-Content $envFile | Where-Object { $_ -match "=" }
$dict = @{}
foreach ($line in $envData) {
    $parts = $line -split "=", 2
    $dict[$parts[0]] = $parts[1]
}

$databaseUrl = $dict["DATABASE_URL"]
if (-not $databaseUrl) {
    throw "DATABASE_URL not found in .env"
}

$dumpFile = Join-Path $OutputDir "anyattend_$timestamp.sql"
pg_dump $databaseUrl -f $dumpFile
Write-Output "Backup created: $dumpFile"
