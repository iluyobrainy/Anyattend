param(
    [switch]$Prod
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pwaPath = Join-Path $root "..\..\apps\pwa"
$vercelCmd = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelCmd) {
    throw "Vercel CLI not found. Install with: npm i -g vercel"
}

Push-Location $pwaPath
try {
    if ($Prod) {
        & vercel --prod
    } else {
        & vercel
    }
} finally {
    Pop-Location
}

