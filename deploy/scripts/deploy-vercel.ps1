param(
    [switch]$Prod,
    [ValidateSet("site", "pwa")]
    [string]$App = "site"
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$appPath = Join-Path $root "..\..\apps\$App"
$vercelCmd = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelCmd) {
    throw "Vercel CLI not found. Install with: npm i -g vercel"
}

Push-Location $appPath
try {
    if ($Prod) {
        & vercel --prod
    } else {
        & vercel
    }
} finally {
    Pop-Location
}
