param()

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runner = Join-Path $repo 'scripts\ci\hackathon-android-v3.ps1'
$delegate = Join-Path $repo 'scripts\ci\hackathon-android-v6.ps1'

if (-not (Test-Path $runner)) { throw "Runner base nao encontrado: $runner" }
if (-not (Test-Path $delegate)) { throw "Runner v6 nao encontrado: $delegate" }

function Clear-StaleMetro {
  $listeners = @(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue)
  foreach ($listener in $listeners) {
    $ownerPid = $listener.OwningProcess
    if ($ownerPid -and $ownerPid -ne $PID) {
      Write-Host "Encerrando listener Metro obsoleto na porta 8081 (PID $ownerPid)." -ForegroundColor Yellow
      Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep 2
  if (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Porta 8081 continua ocupada antes de iniciar o Metro do QA.'
  }
}

$runnerText = Get-Content $runner -Raw
$pattern = '(?s)function Test-RevenueCat \{.*?\r?\n\}\r?\n\r?\ntry \{'
$match = [regex]::Match($runnerText, $pattern)
if (-not $match.Success) {
  throw 'Nao foi possivel localizar Test-RevenueCat no runner base.'
}

$metroOld = 'npx.cmd expo start --dev-client --localhost --port 8081'
$metroNew = 'npx.cmd expo start --dev-client --localhost --port 8081 --clear'
if (-not $runnerText.Contains($metroOld)) {
  throw 'Nao foi possivel localizar o comando Metro para forcar cache limpo.'
}
$runnerText = $runnerText.Replace($metroOld, $metroNew)

$replacement = @'
function Test-RevenueCat {
  param([string]$Adb)

  $package = 'com.engenutri.wheresthemoney'
  $statusFree = 'QA RevenueCat Status configured=true isPro=false'
  $statusPro = 'QA RevenueCat Status configured=true isPro=true'

  $alreadyPro = Wait-Text -Adb $Adb -Candidates @($statusPro) -Seconds 8 -Name 'qa-status-pro-before'

  if (-not $alreadyPro) {
    $freeSeen = Wait-Text -Adb $Adb -Candidates @($statusFree) -Seconds 30 -Name 'qa-status-free-before'
    if (-not $freeSeen) {
      if (Wait-Text -Adb $Adb -Candidates @('QA RevenueCat Action error') -Seconds 2 -Name 'qa-status-error-before') {
        throw 'Controle nativo de QA do RevenueCat reportou erro antes da compra.'
      }
      throw 'Status nativo de QA do RevenueCat nao ficou disponivel.'
    }

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
    if (-not (Wait-Text -Adb $Adb -Candidates @($statusPro) -Seconds 45 -Name 'qa-status-after-purchase')) {
      throw 'RevenueCat nao ativou Pro apos TEST VALID PURCHASE.'
    }
  }

  Invoke-Native -Exe $Adb -Arguments @('shell','am','force-stop',$package) | Out-Null
  Invoke-Native -Exe $Adb -Arguments @(
    'shell','monkey','-p',$package,'-c','android.intent.category.LAUNCHER','1'
  ) | Out-Null

  Start-Sleep 10
  Assert-AppLoaded -Adb $Adb

  if (-not (Wait-Text -Adb $Adb -Candidates @($statusPro) -Seconds 35 -Name 'qa-status-persist')) {
    throw 'RevenueCat nao manteve Pro apos fechar e reabrir o app.'
  }

  Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-pro.png')

  if (-not (Find-And-Tap -Adb $Adb -Candidates @('QA RevenueCat Restore') -Name 'qa-restore')) {
    throw 'Controle nativo QA RevenueCat Restore nao encontrado.'
  }

  if (-not (Wait-Text -Adb $Adb -Candidates @('QA RevenueCat Action restore-complete') -Seconds 35 -Name 'qa-restore-complete')) {
    throw 'Restore Purchases nao concluiu pelo controle nativo QA.'
  }

  if (-not (Wait-Text -Adb $Adb -Candidates @($statusPro) -Seconds 20 -Name 'qa-status-after-restore')) {
    throw 'Restore Purchases concluiu, mas o entitlement Pro nao permaneceu ativo.'
  }
}

try {
'@

$runnerText = $runnerText.Substring(0, $match.Index) + $replacement + $runnerText.Substring($match.Index + $match.Length)

$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseInput($runnerText, [ref]$tokens, [ref]$parseErrors) | Out-Null
if (@($parseErrors).Count -gt 0) {
  $detail = @($parseErrors | ForEach-Object { $_.Message }) -join ' | '
  throw "Runner RevenueCat QA gerado com sintaxe invalida: $detail"
}

Set-Content -Path $runner -Value $runnerText -Encoding utf8

# Os controles QA so aparecem em build de desenvolvimento com esta flag explicita.
$env:EXPO_PUBLIC_QA_AUTOMATION = '1'
if ($env:EXPO_PUBLIC_QA_AUTOMATION -ne '1') {
  throw 'Flag EXPO_PUBLIC_QA_AUTOMATION nao foi aplicada ao processo de QA.'
}

Clear-StaleMetro
Write-Host 'RevenueCat QA: controles nativos dev-only habilitados; Metro limpo e runner validado antes do build.' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $delegate
if ($LASTEXITCODE -ne 0) {
  throw "hackathon-android-v6.ps1 falhou (exit $LASTEXITCODE)"
}
