param()

$ErrorActionPreference = 'Stop'
$repoLong = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runKey = if ($env:CI_COMMIT_SHA) { $env:CI_COMMIT_SHA.Substring(0, [Math]::Min(8, $env:CI_COMMIT_SHA.Length)) } else { Get-Date -Format 'HHmmss' }
$shortRootBase = 'C:\w'
$shortRepo = Join-Path $shortRootBase ("h-$runKey")
$originalArtifacts = Join-Path $repoLong 'artifacts'
$shortArtifacts = Join-Path $shortRepo 'artifacts'
$runner = Join-Path $shortRepo 'scripts\ci\hackathon-android-v10.ps1'
$exitCode = 1

function Sync-ArtifactsBack {
  if (Test-Path $shortArtifacts) {
    New-Item -ItemType Directory -Force -Path $originalArtifacts | Out-Null
    Copy-Item (Join-Path $shortArtifacts '*') $originalArtifacts -Recurse -Force -ErrorAction SilentlyContinue
  }
}

try {
  New-Item -ItemType Directory -Force -Path $shortRootBase | Out-Null
  if (Test-Path $shortRepo) {
    Remove-Item $shortRepo -Recurse -Force -ErrorAction Stop
  }
  New-Item -ItemType Directory -Force -Path $shortRepo | Out-Null

  Write-Host "Copiando workspace para caminho fisico curto: $shortRepo" -ForegroundColor Cyan
  $roboArgs = @(
    $repoLong,
    $shortRepo,
    '/E',
    '/R:2',
    '/W:1',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/NP',
    '/XD',
    '.git',
    'node_modules',
    'dist',
    'artifacts',
    '.expo',
    '.wrangler',
    'android',
    '/XF',
    '.env',
    '.dev.vars'
  )
  & robocopy.exe @roboArgs | Out-Host
  $roboExit = $LASTEXITCODE
  if ($roboExit -ge 8) {
    throw "robocopy falhou (exit $roboExit)"
  }

  if (-not (Test-Path $runner)) {
    throw "Runner Android versionado nao encontrado no workspace curto: $runner"
  }

  $resolvedShort = (Resolve-Path $shortRepo).Path
  if ($resolvedShort.Length -gt 40) {
    throw "Workspace curto continua longo demais: $resolvedShort"
  }

  $tokens = $null
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($runner, [ref]$tokens, [ref]$parseErrors) | Out-Null
  if (@($parseErrors).Count -gt 0) {
    $detail = @($parseErrors | ForEach-Object { $_.Message }) -join ' | '
    throw "Runner Android versionado com sintaxe invalida: $detail"
  }

  $env:CI = 'true'
  $env:EXPO_PUBLIC_QA_AUTOMATION = '1'
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'

  Write-Host "Workspace Android fisico: $resolvedShort" -ForegroundColor Green
  Write-Host 'Runner Android v10 validado; readiness do Metro aceita listener IPv4 ou IPv6.' -ForegroundColor Green
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner
  $exitCode = $LASTEXITCODE
  Sync-ArtifactsBack

  if ($exitCode -ne 0) {
    throw "hackathon-android-v10.ps1 falhou (exit $exitCode)"
  }
}
finally {
  try { Sync-ArtifactsBack } catch {}
  try { Set-Location 'C:\' } catch {}
  try {
    if (Test-Path $shortRepo) {
      Remove-Item $shortRepo -Recurse -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}
