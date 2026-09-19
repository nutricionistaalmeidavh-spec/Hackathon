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
  $statusFree = 'QA RevenueCat Status configured=true isPro=false'
  $statusPro = 'QA RevenueCat Status configured=true isPro=true'

  function Get-QaProState {
    param([string]$Name)
    $xml = Dump-Ui -Adb $Adb -Name $Name
    if (Find-Node -Xml $xml -Candidates @($statusPro)) { return $true }
    if (Find-Node -Xml $xml -Candidates @($statusFree)) { return $false }
    if (Find-Node -Xml $xml -Candidates @('QA RevenueCat Action error')) {
      throw 'Controle nativo de QA do RevenueCat reportou erro.'
    }
    return $null
  }

  function Wait-QaProState {
    param([int]$Seconds=35,[string]$Name='qa-status')
    $deadline = (Get-Date).AddSeconds($Seconds)
    $n = 0
    do {
      Start-Sleep 2
      $state = Get-QaProState -Name "$Name-$n"
      if ($null -ne $state) { return [bool]$state }
      $n++
    } until ((Get-Date) -gt $deadline)
    throw 'Status nativo de QA do RevenueCat nao ficou disponivel.'
  }

  $alreadyPro = Wait-QaProState -Seconds 35 -Name 'qa-status-before'

  if (-not $alreadyPro) {
    if (-not (Find-And-Tap -Adb $Adb -Candidates @('QA RevenueCat Open Plan') -Name 'qa-open-plan')) {
      throw 'Controle nativo QA RevenueCat Open Plan nao encontrado.'
    }

    Start-Sleep 4
    Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-paywall.png')

    $valid = $false
    $purchaseDeadline = (Get-Date).AddSeconds(50)
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
      throw 'TEST VALID PURCHASE nao apareceu no paywall RevenueCat aberto pelo controle nativo QA.'
    }

    Start-Sleep 8
    $becamePro = Wait-QaProState -Seconds 45 -Name 'qa-status-after-purchase'
    if (-not $becamePro) {
      throw 'RevenueCat nao ativou Pro apos TEST VALID PURCHASE.'
    }
  }

  Invoke-Native -Exe $Adb -Arguments @('shell','am','force-stop',$package) | Out-Null
  Invoke-Native -Exe $Adb -Arguments @(
    'shell','monkey','-p',$package,'-c','android.intent.category.LAUNCHER','1'
  ) | Out-Null

  Start-Sleep 10
  Assert-AppLoaded -Adb $Adb

  $persistedPro = Wait-QaProState -Seconds 35 -Name 'qa-status-persist'
  if (-not $persistedPro) {
    throw 'RevenueCat nao manteve Pro apos fechar e reabrir o app.'
  }

  Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-pro.png')

  if (-not (Find-And-Tap -Adb $Adb -Candidates @('QA RevenueCat Restore') -Name 'qa-restore')) {
    throw 'Controle nativo QA RevenueCat Restore nao encontrado.'
  }

  if (-not (Wait-Text -Adb $Adb -Candidates @('QA RevenueCat Action restore-complete') -Seconds 35 -Name 'qa-restore-complete')) {
    throw 'Restore Purchases nao concluiu pelo controle nativo QA.'
  }

  $restoredPro = Wait-QaProState -Seconds 20 -Name 'qa-status-after-restore'
  if (-not $restoredPro) {
    throw 'Restore Purchases concluiu, mas o entitlement Pro nao permaneceu ativo.'
  }
}

try {
'@

$runnerText = $runnerText.Substring(0, $match.Index) + $replacement + $runnerText.Substring($match.Index + $match.Length)
Set-Content -Path $runner -Value $runnerText -Encoding utf8

# Os controles QA so aparecem em build de desenvolvimento com esta flag explicita.
$env:EXPO_PUBLIC_QA_AUTOMATION = '1'

Write-Host 'RevenueCat QA: controles nativos dev-only habilitados para esta execucao.' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $delegate
if ($LASTEXITCODE -ne 0) {
  throw "hackathon-android-v6.ps1 falhou (exit $LASTEXITCODE)"
}
