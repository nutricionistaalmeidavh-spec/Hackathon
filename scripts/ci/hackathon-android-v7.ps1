param()

$ErrorActionPreference = 'Stop'
$env:CI = 'true'
$env:EXPO_PUBLIC_QA_AUTOMATION = '1'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$delegate = Join-Path $repo 'scripts\ci\hackathon-android-v6.ps1'

if (-not (Test-Path $delegate)) {
  throw "Runner Android v6 nao encontrado: $delegate"
}

Write-Host 'RevenueCat QA usa runner v9 versionado; nenhuma substituicao dinamica sera aplicada.' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $delegate
if ($LASTEXITCODE -ne 0) {
  throw "hackathon-android-v6.ps1 falhou (exit $LASTEXITCODE)"
}
