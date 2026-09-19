param()

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$artifactDir = Join-Path $repo 'artifacts'
$logPath = Join-Path $artifactDir 'woodpecker-hackathon-android.log'
$qaPath = Join-Path $artifactDir 'qa-summary.json'
$delegate = Join-Path $repo 'scripts\ci\hackathon-android-v7.ps1'

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
Set-Content -Path $logPath -Value "Hackathon Android QA supervisor - $(Get-Date -Format o)" -Encoding utf8

function Write-FallbackFailure {
  param(
    [string]$Message,
    [Nullable[int]]$ExitCode = $null,
    [string]$Action = 'scripts/ci/hackathon-android-v7.ps1'
  )

  $summary = [pscustomobject]@{
    status = 'FAIL'
    counts = @{ flowsPassed = 0; flowsFailed = 1 }
    flows = @(
      [pscustomobject]@{
        flow = 'android-preflight'
        status = 'FAIL'
        error = $Message
        failedStep = @{
          name = 'android-preflight'
          action = $Action
          error = $Message
          exitCode = $ExitCode
        }
        evidence = @{
          runSummary = $qaPath
          outputDir = $artifactDir
          log = $logPath
        }
      }
    )
  }

  $summary | ConvertTo-Json -Depth 10 | Set-Content -Path $qaPath -Encoding utf8
}

if (-not (Test-Path $delegate)) {
  $message = "Runner Android v7 nao encontrado: $delegate"
  Add-Content -Path $logPath -Value $message -Encoding utf8
  Write-FallbackFailure -Message $message -ExitCode 1
  throw $message
}

$output = @()
$exitCode = 1
$oldPreference = $ErrorActionPreference
try {
  $ErrorActionPreference = 'Continue'
  $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $delegate 2>&1)
  $exitCode = $LASTEXITCODE
} catch {
  $output += $_.Exception.Message
  $exitCode = 1
} finally {
  $ErrorActionPreference = $oldPreference
}

foreach ($line in $output) {
  $text = [string]$line
  Write-Host $text
  Add-Content -Path $logPath -Value $text -Encoding utf8
}

if ($exitCode -ne 0) {
  $tail = (@($output) | Select-Object -Last 40 | ForEach-Object { [string]$_ }) -join "`n"
  $message = "hackathon-android-v7.ps1 falhou (exit $exitCode)"
  if ($tail) { $message += ":`n$tail" }

  if (-not (Test-Path $qaPath)) {
    Write-FallbackFailure -Message $message -ExitCode $exitCode
  } else {
    Add-Content -Path $logPath -Value "`nSupervisor: qa-summary existente preservado. exit=$exitCode" -Encoding utf8
  }

  throw $message
}

if (-not (Test-Path $qaPath)) {
  $message = 'Android QA terminou sem gerar qa-summary.json; resultado nao pode ser considerado valido.'
  Add-Content -Path $logPath -Value $message -Encoding utf8
  Write-FallbackFailure -Message $message -ExitCode 1
  throw $message
}

Add-Content -Path $logPath -Value 'Supervisor Android QA: delegate concluiu com exit=0 e qa-summary presente.' -Encoding utf8
Write-Host 'Hackathon Android QA supervisor: PASS' -ForegroundColor Green
