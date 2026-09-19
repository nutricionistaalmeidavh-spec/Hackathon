param()

$ErrorActionPreference = 'Stop'
$repoLong = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runKey = if ($env:CI_COMMIT_SHA) { $env:CI_COMMIT_SHA.Substring(0, [Math]::Min(8, $env:CI_COMMIT_SHA.Length)) } else { Get-Date -Format 'HHmmss' }
$shortRootBase = 'C:\w'
$shortRepo = Join-Path $shortRootBase ("h-$runKey")
$originalArtifacts = Join-Path $repoLong 'artifacts'
$shortArtifacts = Join-Path $shortRepo 'artifacts'
$runner = Join-Path $shortRepo 'scripts\ci\hackathon-android-v11.ps1'
$bootstrap = Join-Path $shortRepo 'scripts\ci\hackathon-devclient-bootstrap.ps1'
$exitCode = 1
$bootstrapProcess = $null

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
  if (-not (Test-Path $bootstrap)) {
    throw "Bootstrap do Expo dev client nao encontrado: $bootstrap"
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

  $bootstrapTokens = $null
  $bootstrapParseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($bootstrap, [ref]$bootstrapTokens, [ref]$bootstrapParseErrors) | Out-Null
  if (@($bootstrapParseErrors).Count -gt 0) {
    $detail = @($bootstrapParseErrors | ForEach-Object { $_.Message }) -join ' | '
    throw "Bootstrap do Expo dev client com sintaxe invalida: $detail"
  }

  $env:CI = 'true'
  $env:EXPO_PUBLIC_QA_AUTOMATION = '1'
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'
  $env:ARTISYS_HACKATHON_METRO_SOURCE = $repoLong

  $adbPath = if ($env:ANDROID_HOME) {
    Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
  } else {
    'C:\Users\Marcio\AppData\Local\Android\Sdk\platform-tools\adb.exe'
  }
  $bootstrapLog = Join-Path $shortArtifacts 'devclient-bootstrap.log'

  Write-Host "Workspace Android fisico: $resolvedShort" -ForegroundColor Green
  Write-Host "Metro sera executado no workspace original: $repoLong" -ForegroundColor Green
  Write-Host 'Runner Android v11 validado; build curto e Metro original separados.' -ForegroundColor Green
  Write-Host 'Bootstrap do Expo dev client sera automatizado antes do smoke.' -ForegroundColor Green

  $bootstrapProcess = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy','Bypass',
    '-File',$bootstrap,
    '-AdbPath',$adbPath,
    '-LogPath',$bootstrapLog
  )

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner
  $exitCode = $LASTEXITCODE
  Sync-ArtifactsBack

  if ($exitCode -ne 0) {
    throw "hackathon-android-v11.ps1 falhou (exit $exitCode)"
  }
}
finally {
  try {
    if ($bootstrapProcess -and -not $bootstrapProcess.HasExited) {
      Stop-Process -Id $bootstrapProcess.Id -Force -ErrorAction SilentlyContinue
    }
  } catch {}
  try { Sync-ArtifactsBack } catch {}
  try { Set-Location 'C:\' } catch {}
  try {
    if (Test-Path $shortRepo) {
      Remove-Item $shortRepo -Recurse -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}
