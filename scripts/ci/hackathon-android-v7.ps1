param()

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runner = Join-Path $repo 'scripts\ci\hackathon-android-v3.ps1'
$delegate = Join-Path $repo 'scripts\ci\hackathon-android-v6.ps1'

if (-not (Test-Path $runner)) { throw "Runner base nao encontrado: $runner" }
if (-not (Test-Path $delegate)) { throw "Runner v6 nao encontrado: $delegate" }

$runnerText = Get-Content $runner -Raw
$pattern = '(?s)function Test-RevenueCat \{.*?\r?\n\}\r?\n\r?\ntry \{'
$match = [regex]::Match($runnerText, $pattern)
if (-not $match.Success) {
  throw 'Nao foi possivel localizar Test-RevenueCat no runner base.'
}

$replacement = @'
function Test-RevenueCat {
  param([string]$Adb)

  $package = 'com.engenutri.wheresthemoney'
  $metroQaLog = Join-Path $artifactDir 'metro.log'

  function New-QaRun {
    param([string]$Prefix)
    return "$Prefix-$(([guid]::NewGuid().ToString('N')).Substring(0,8))"
  }

  function Invoke-QaLink {
    param([string]$Action,[string]$Run)
    $url = "wheresthemoney://qa/revenuecat/$Action?run=$Run"
    Invoke-Native -Exe $Adb -Arguments @(
      'shell','am','start','-W',
      '-a','android.intent.action.VIEW',
      '-d',$url,
      '-p',$package
    ) | Out-Null
  }

  function Read-QaMarkers {
    $lines = @()
    if (Test-Path $metroQaLog) {
      $lines += @(Get-Content $metroQaLog -Tail 500 -ErrorAction SilentlyContinue)
    }

    $oldPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $lines += @(& $Adb logcat -d -t 500 2>&1)
    } finally {
      $ErrorActionPreference = $oldPreference
    }

    return @(
      $lines |
        ForEach-Object { [string]$_ } |
        Where-Object { $_ -match '\[WTM_QA_REVENUECAT\]' }
    )
  }

  function Wait-QaMarker {
    param([string]$Run,[string]$Action,[int]$Seconds=30)

    $runPattern = "run=$([regex]::Escape($Run))(?=\s|$)"
    $actionPattern = "action=$([regex]::Escape($Action))(?=\s|$)"
    $deadline = (Get-Date).AddSeconds($Seconds)

    do {
      Start-Sleep 2
      $marker = @(
        Read-QaMarkers |
          Where-Object { $_ -match $runPattern -and $_ -match $actionPattern } |
          Select-Object -Last 1
      )
      if ($marker.Count) {
        Write-Host $marker[0]
        return [string]$marker[0]
      }
    } until ((Get-Date) -gt $deadline)

    $all = (Read-QaMarkers | Select-Object -Last 20) -join "`n"
    throw "Marker RevenueCat QA nao encontrado: action=$Action run=$Run`n$all"
  }

  $stateRun = New-QaRun -Prefix 'state-before'
  Invoke-QaLink -Action 'state' -Run $stateRun
  $stateLine = Wait-QaMarker -Run $stateRun -Action 'state' -Seconds 25

  if ($stateLine -notmatch 'configured=true') {
    throw "RevenueCat QA hook respondeu sem SDK configurado: $stateLine"
  }

  $alreadyPro = $stateLine -match 'isPro=true'

  if (-not $alreadyPro) {
    $openRun = New-QaRun -Prefix 'open'
    Invoke-QaLink -Action 'open-plan' -Run $openRun

    $beforeLine = Wait-QaMarker -Run $openRun -Action 'open-plan-before' -Seconds 25
    if ($beforeLine -notmatch 'configured=true') {
      throw "RevenueCat nao estava configurado antes do paywall: $beforeLine"
    }

    Start-Sleep 4
    Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-paywall.png')

    $valid = $false
    $purchaseDeadline = (Get-Date).AddSeconds(45)
    do {
      try {
        $valid = Find-And-Tap -Adb $Adb -Candidates @('TEST VALID PURCHASE') -Name 'qa-valid-direct'
      } catch {}

      if ($valid) { break }

      $purchase = $false
      try {
        $purchase = Find-And-Tap -Adb $Adb -Candidates @(
          'Test Store Purchase',
          'Subscribe',
          'Continue',
          'Get Pro',
          'Upgrade',
          'Assinar',
          'Purchase'
        ) -Name 'qa-purchase' -Scrolls 2
      } catch {}

      if ($purchase) { Start-Sleep 3 }

      try {
        $valid = Find-And-Tap -Adb $Adb -Candidates @('TEST VALID PURCHASE') -Name 'qa-valid-after'
      } catch {}

      if (-not $valid) { Start-Sleep 2 }
    } until ($valid -or (Get-Date) -gt $purchaseDeadline)

    if (-not $valid) {
      throw 'TEST VALID PURCHASE nao apareceu no fluxo RevenueCat acionado pelo hook nativo.'
    }

    Start-Sleep 8

    $purchaseConfirmed = $false
    try {
      $resultLine = Wait-QaMarker -Run $openRun -Action 'open-plan-result' -Seconds 45
      $purchaseConfirmed = $resultLine -match 'isPro=true'
    } catch {}

    if (-not $purchaseConfirmed) {
      $verifyRun = New-QaRun -Prefix 'state-after-purchase'
      Invoke-QaLink -Action 'state' -Run $verifyRun
      $verifyLine = Wait-QaMarker -Run $verifyRun -Action 'state' -Seconds 25
      if ($verifyLine -notmatch 'isPro=true') {
        throw "RevenueCat nao ativou Pro apos TEST VALID PURCHASE: $verifyLine"
      }
    }
  }

  Invoke-Native -Exe $Adb -Arguments @('shell','am','force-stop',$package) | Out-Null
  Invoke-Native -Exe $Adb -Arguments @(
    'shell','monkey','-p',$package,'-c','android.intent.category.LAUNCHER','1'
  ) | Out-Null

  Start-Sleep 10
  Assert-AppLoaded -Adb $Adb

  $persistRun = New-QaRun -Prefix 'state-persist'
  Invoke-QaLink -Action 'state' -Run $persistRun
  $persistLine = Wait-QaMarker -Run $persistRun -Action 'state' -Seconds 25
  if ($persistLine -notmatch 'isPro=true') {
    throw "RevenueCat nao manteve Pro apos reabrir: $persistLine"
  }

  Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-pro.png')

  $restoreRun = New-QaRun -Prefix 'restore'
  Invoke-QaLink -Action 'restore' -Run $restoreRun
  $restoreLine = Wait-QaMarker -Run $restoreRun -Action 'restore' -Seconds 35
  if ($restoreLine -notmatch 'isPro=true') {
    throw "Restore Purchases nao preservou Pro: $restoreLine"
  }
}

try {
'@

$runnerText = $runnerText.Substring(0, $match.Index) + $replacement + $runnerText.Substring($match.Index + $match.Length)
Set-Content -Path $runner -Value $runnerText -Encoding utf8

# O hook so existe em build de desenvolvimento e exige esta flag explicita.
$env:EXPO_PUBLIC_QA_AUTOMATION = '1'

Write-Host 'RevenueCat QA: hook nativo dev-only habilitado para esta execucao.' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $delegate
if ($LASTEXITCODE -ne 0) {
  throw "hackathon-android-v6.ps1 falhou (exit $LASTEXITCODE)"
}
