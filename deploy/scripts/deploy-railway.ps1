param(
    [switch]$Detach
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Join-Path $root "..\.."
$railwayCmd = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayCmd) {
    throw "Railway CLI not found. Install from https://docs.railway.com/guides/cli"
}

Push-Location $repoRoot
try {
    if ($Detach) {
        & railway up --detach
    } else {
        & railway up
    }
} finally {
    Pop-Location
}

