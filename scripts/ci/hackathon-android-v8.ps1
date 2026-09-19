param()

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$artifactDir = Join-Path $repo 'artifacts'
$logPath = Join-Path $artifactDir 'woodpecker-hackathon-supervisor.log'
$qaPath = Join-Path $artifactDir 'qa-summary.json'
$stdoutPath = Join-Path $artifactDir 'android-runner-stdout.log'
$stderrPath = Join-Path $artifactDir 'android-runner-stderr.log'
$delegate = Join-Path $repo 'scripts\ci\hackathon-android-v6.ps1'
$hardTimeoutMinutes = 35

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
Set-Content -Path $logPath -Value "Hackathon Android QA supervisor - $(Get-Date -Format o)" -Encoding utf8
Remove-Item $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue

function Write-FallbackFailure {
  param(
    [string]$Message,
    [Nullable[int]]$ExitCode = $null,
    [string]$Action = 'scripts/ci/hackathon-android-v6.ps1'
  )

  $summary = [pscustomobject]@{
    status = 'FAIL'
    counts = @{ flowsPassed = 0; flowsFailed = 1 }
    flows = @(
      [pscustomobject]@{
        flow = 'android-supervisor'
        status = 'FAIL'
        error = $Message
        failedStep = @{
          name = 'android-supervisor'
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

function Ensure-FailureSummary {
  param([string]$Message,[Nullable[int]]$ExitCode = $null)

  $hasDetailedFailure = $false
  if (Test-Path $qaPath) {
    try {
      $existing = Get-Content $qaPath -Raw | ConvertFrom-Json
      $hasDetailedFailure = $existing.status -eq 'FAIL'
    } catch {}
  }

  if (-not $hasDetailedFailure) {
    Write-FallbackFailure -Message $Message -ExitCode $ExitCode
  }
}

function Emit-NewLogChunk {
  param([string]$Path,[ref]$Offset,[string]$Label)

  if (-not (Test-Path $Path)) { return }
  try {
    $text = Get-Content $Path -Raw -ErrorAction Stop
    if ($null -eq $text) { return }
    if ($Offset.Value -gt $text.Length) { $Offset.Value = 0 }
    if ($text.Length -le $Offset.Value) { return }

    $chunk = $text.Substring($Offset.Value)
    $Offset.Value = $text.Length
    if ($Label) { Write-Host "[$Label]" -ForegroundColor DarkGray }
    Write-Host -NoNewline $chunk
    [System.IO.File]::AppendAllText($logPath, $chunk)
  } catch {}
}

function Sync-ShortArtifacts {
  if (-not $env:CI_COMMIT_SHA) { return }
  $key = $env:CI_COMMIT_SHA.Substring(0, [Math]::Min(8, $env:CI_COMMIT_SHA.Length))
  $shortArtifacts = Join-Path (Join-Path 'C:\w' ("h-$key")) 'artifacts'
  if (Test-Path $shortArtifacts) {
    Copy-Item (Join-Path $shortArtifacts '*') $artifactDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path $delegate)) {
  $message = "Runner Android v6 nao encontrado: $delegate"
  Add-Content -Path $logPath -Value $message -Encoding utf8
  Write-FallbackFailure -Message $message -ExitCode 1
  throw $message
}

$stdoutOffset = 0
$stderrOffset = 0
$process = $null
$timedOut = $false
$exitCode = 1

try {
  Write-Host "Android QA: logs em tempo real habilitados; timeout absoluto de $hardTimeoutMinutes minutos." -ForegroundColor Cyan
  $process = Start-Process powershell.exe `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$delegate`"" `
    -PassThru `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath

  $deadline = (Get-Date).AddMinutes($hardTimeoutMinutes)
  Write-Host "Android QA runner iniciado (PID $($process.Id))." -ForegroundColor Cyan

  while (-not $process.HasExited) {
    Emit-NewLogChunk -Path $stdoutPath -Offset ([ref]$stdoutOffset) -Label 'stdout'
    Emit-NewLogChunk -Path $stderrPath -Offset ([ref]$stderrOffset) -Label 'stderr'

    if ((Get-Date) -gt $deadline) {
      $timedOut = $true
      $message = "Android QA excedeu o timeout absoluto de $hardTimeoutMinutes minutos; encerrando arvore de processos PID $($process.Id)."
      Write-Host $message -ForegroundColor Red
      Add-Content -Path $logPath -Value $message -Encoding utf8
      try {
        @(& taskkill.exe /PID $process.Id /T /F 2>&1) | ForEach-Object {
          Write-Host $_
          Add-Content -Path $logPath -Value ([string]$_) -Encoding utf8
        }
      } catch {}
      break
    }

    Start-Sleep 3
    $process.Refresh()
  }

  if (-not $timedOut) {
    $process.WaitForExit()
    $exitCode = $process.ExitCode
  } else {
    $exitCode = 124
    try { $process.WaitForExit(10000) | Out-Null } catch {}
  }
} catch {
  $exitCode = 1
  $message = "Falha no supervisor Android: $($_.Exception.Message)"
  Write-Host $message -ForegroundColor Red
  Add-Content -Path $logPath -Value $message -Encoding utf8
} finally {
  Emit-NewLogChunk -Path $stdoutPath -Offset ([ref]$stdoutOffset) -Label 'stdout-final'
  Emit-NewLogChunk -Path $stderrPath -Offset ([ref]$stderrOffset) -Label 'stderr-final'
  try { Sync-ShortArtifacts } catch {}
}

if ($exitCode -ne 0) {
  $tail = @()
  if (Test-Path $stdoutPath) { $tail += @(Get-Content $stdoutPath -Tail 40 -ErrorAction SilentlyContinue) }
  if (Test-Path $stderrPath) { $tail += @(Get-Content $stderrPath -Tail 40 -ErrorAction SilentlyContinue) }

  $message = if ($timedOut) {
    "Android QA interrompido por timeout absoluto de $hardTimeoutMinutes minutos (exit 124)."
  } else {
    "hackathon-android-v6.ps1 falhou (exit $exitCode)."
  }
  if ($tail.Count -gt 0) { $message += "`n" + (($tail | ForEach-Object { [string]$_ }) -join "`n") }

  Ensure-FailureSummary -Message $message -ExitCode $exitCode
  Add-Content -Path $logPath -Value $message -Encoding utf8
  throw $message
}

if (-not (Test-Path $qaPath)) {
  $message = 'Android QA terminou sem gerar qa-summary.json; resultado nao pode ser considerado valido.'
  Add-Content -Path $logPath -Value $message -Encoding utf8
  Write-FallbackFailure -Message $message -ExitCode 1
  throw $message
}

Add-Content -Path $logPath -Value 'Supervisor Android QA: runner versionado concluiu com exit=0 e qa-summary presente.' -Encoding utf8
Write-Host 'Hackathon Android QA supervisor: PASS' -ForegroundColor Green
