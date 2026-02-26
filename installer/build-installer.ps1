param(
    [string]$SignToolPath = "",
    [string]$CertificateThumbprint = ""
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $root

Write-Output "Building agent binaries..."
& (Join-Path $repoRoot "agent\build-agent.ps1")
if ($LASTEXITCODE -ne 0) { throw "Agent build failed." }

$iss = Join-Path $root "Anyattend.iss"
if (-not (Get-Command iscc -ErrorAction SilentlyContinue) -and (Test-Path "C:\Program Files (x86)\Inno Setup 6\ISCC.exe")) {
    Set-Alias -Name iscc -Value "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
}
if (-not (Get-Command iscc -ErrorAction SilentlyContinue) -and (Test-Path "C:\Program Files\Inno Setup 6\ISCC.exe")) {
    Set-Alias -Name iscc -Value "C:\Program Files\Inno Setup 6\ISCC.exe"
}
if (-not (Get-Command iscc -ErrorAction SilentlyContinue) -and (Test-Path "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe")) {
    Set-Alias -Name iscc -Value "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
}
if (-not (Get-Command iscc -ErrorAction SilentlyContinue)) {
    throw "Inno Setup compiler (iscc) not found in PATH."
}

Write-Output "Compiling installer..."
& iscc $iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed." }

if ($SignToolPath -and $CertificateThumbprint) {
    $setupExe = Join-Path $root "Output\Anyattend-Setup.exe"
    & $SignToolPath sign /sha1 $CertificateThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $setupExe
    if ($LASTEXITCODE -ne 0) { throw "Code signing failed." }
    Write-Output "Installer signed."
}

Write-Output "Installer build complete."
