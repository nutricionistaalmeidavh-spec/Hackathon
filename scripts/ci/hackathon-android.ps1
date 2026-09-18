param()

$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repo

$artifactDir = Join-Path $repo 'artifacts'
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$logPath = Join-Path $artifactDir 'woodpecker-hackathon-android.log'
$qaPath = Join-Path $artifactDir 'qa-summary.json'
$flows = @()
$metroProcess = $null
$mutex = New-Object System.Threading.Mutex($false, 'ArtiSysHackathonAndroidQA')
$hasMutex = $false

$secretSource = if ($env:ARTISYS_HACKATHON_SECRETS_SOURCE) {
  $env:ARTISYS_HACKATHON_SECRETS_SOURCE
} else {
  'C:\Users\Marcio\StudioProjects\Hackathon'
}

$persistRoot = if ($env:ARTISYS_HACKATHON_QA_ROOT) {
  $env:ARTISYS_HACKATHON_QA_ROOT
} else {
  'C:\VICTOR\Hackathon-QA\woodpecker'
}

$runKey = if ($env:CI_COMMIT_SHA) { $env:CI_COMMIT_SHA.Substring(0, [Math]::Min(12, $env:CI_COMMIT_SHA.Length)) } else { Get-Date -Format 'yyyyMMdd-HHmmss' }
$persistDir = Join-Path $persistRoot $runKey
New-Item -ItemType Directory -Force -Path $persistDir | Out-Null

function Add-FlowResult {
  param([string]$Name, [string]$Status, [string]$Error = '', [hashtable]$Evidence = @{})
  $script:flows += [pscustomobject]@{
    flow = $Name
    status = $Status
    error = $Error
    evidence = $Evidence
  }
}

function Save-Summary {
  $passed = @($flows | Where-Object status -eq 'PASS').Count
  $failed = @($flows | Where-Object status -eq 'FAIL').Count
  [pscustomobject]@{
    status = if ($failed) { 'FAIL' } else { 'PASS' }
    counts = @{ flowsPassed = $passed; flowsFailed = $failed }
    flows = $flows
  } | ConvertTo-Json -Depth 10 | Set-Content -Path $qaPath -Encoding utf8
}

function Invoke-Native {
  param([string]$Exe, [string[]]$Args = @())
  & $Exe @Args *>&1 | Tee-Object -FilePath $logPath -Append
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "$Exe terminou com exit code $code" }
}

function Invoke-Flow {
  param([string]$Name, [scriptblock]$Action)
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  try {
    & $Action
    Add-FlowResult -Name $Name -Status 'PASS' -Evidence @{ runSummary = $qaPath; outputDir = $persistDir }
  } catch {
    $failureShot = Join-Path $artifactDir 'failure.png'
    try { Capture-Screen -Path $failureShot } catch {}
    Add-FlowResult -Name $Name -Status 'FAIL' -Error $_.Exception.Message -Evidence @{
      runSummary = $qaPath
      outputDir = $persistDir
      screenshot = $failureShot
    }
    Save-Summary
    throw
  }
}

function Copy-LocalSecrets {
  $mobileEnvSource = Join-Path $secretSource 'apps\mobile\.env'
  $workerEnvSource = Join-Path $secretSource '.dev.vars'
  $mobileEnvTarget = Join-Path $repo 'apps\mobile\.env'
  $workerEnvTarget = Join-Path $repo '.dev.vars'

  if (-not (Test-Path $mobileEnvTarget)) {
    if (-not (Test-Path $mobileEnvSource)) { throw "Mobile .env nao encontrado em $mobileEnvSource" }
    Copy-Item $mobileEnvSource $mobileEnvTarget -Force
  }
  if (-not (Test-Path $workerEnvTarget) -and (Test-Path $workerEnvSource)) {
    Copy-Item $workerEnvSource $workerEnvTarget -Force
  }

  $keys = Get-Content $mobileEnvTarget -ErrorAction Stop
  if (-not ($keys -match '^EXPO_PUBLIC_REVENUECAT_API_KEY=.+')) { throw 'EXPO_PUBLIC_REVENUECAT_API_KEY ausente no .env mobile.' }
  if (-not ($keys -match '^EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro$')) { throw 'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID precisa ser pro.' }
}

function Get-AndroidTools {
  if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'C:\Users\Marcio\AppData\Local\Android\Sdk' }
  $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
  $emulator = Join-Path $env:ANDROID_HOME 'emulator\emulator.exe'
  if (-not (Test-Path $adb)) { throw "adb nao encontrado: $adb" }
  if (-not (Test-Path $emulator)) { throw "emulator nao encontrado: $emulator" }
  return @{ adb = $adb; emulator = $emulator }
}

function Ensure-Emulator {
  param([string]$Adb, [string]$Emulator)
  Invoke-Native $Adb @('start-server')
  $deviceLines = & $Adb devices
  if ($deviceLines -match 'emulator-\d+\s+device') { return }

  $avds = & $Emulator -list-avds
  $avd = $avds | Where-Object { $_ -eq 'Pixel_9' } | Select-Object -First 1
  if (-not $avd) { $avd = $avds | Select-Object -First 1 }
  if (-not $avd) { throw 'Nenhum AVD Android encontrado.' }

  Start-Process $Emulator -ArgumentList @('-avd', $avd, '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot-save') | Out-Null
  $deadline = (Get-Date).AddMinutes(4)
  do {
    Start-Sleep 3
    $deviceLines = & $Adb devices
  } until (($deviceLines -match 'emulator-\d+\s+device') -or (Get-Date) -gt $deadline)
  if (-not ($deviceLines -match 'emulator-\d+\s+device')) { throw 'Emulador nao apareceu no adb.' }

  do {
    Start-Sleep 3
    $boot = (& $Adb shell getprop sys.boot_completed 2>$null).Trim()
  } until ($boot -eq '1' -or (Get-Date) -gt $deadline)
  if ($boot -ne '1') { throw 'Android nao concluiu o boot.' }
}

function Start-Metro {
  param([string]$Adb)
  Invoke-Native $Adb @('reverse', 'tcp:8081', 'tcp:8081')
  $metroLog = Join-Path $artifactDir 'metro.log'
  $mobile = Join-Path $repo 'apps\mobile'
  $command = "Set-Location '$mobile'; npx expo start --dev-client --localhost --port 8081 *> '$metroLog'"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
  $script:metroProcess = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList '-NoProfile', '-EncodedCommand', $encoded

  $deadline = (Get-Date).AddSeconds(90)
  do {
    Start-Sleep 2
    $ready = (Test-NetConnection 127.0.0.1 -Port 8081 -WarningAction SilentlyContinue).TcpTestSucceeded
  } until ($ready -or (Get-Date) -gt $deadline)
  if (-not $ready) { throw "Metro nao abriu 8081. Verifique $metroLog" }
}

function Dump-Ui {
  param([string]$Adb, [string]$Name)
  $remote = '/sdcard/window.xml'
  $local = Join-Path $artifactDir "$Name.xml"
  for ($i = 0; $i -lt 3; $i++) {
    & $Adb shell uiautomator dump $remote | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep 2
  }
  Invoke-Native $Adb @('pull', $remote, $local)
  [xml](Get-Content $local -Raw)
}

function Find-UiNode {
  param([xml]$Xml, [string[]]$Candidates)
  foreach ($candidate in $Candidates) {
    $node = $Xml.SelectNodes('//node') | Where-Object {
      $text = $_.GetAttribute('text')
      $desc = $_.GetAttribute('content-desc')
      $text -eq $candidate -or $desc -eq $candidate -or $text -like "*$candidate*" -or $desc -like "*$candidate*"
    } | Select-Object -First 1
    if ($node) { return $node }
  }
  return $null
}

function Tap-Node {
  param([string]$Adb, $Node)
  $bounds = $Node.GetAttribute('bounds')
  if ($bounds -notmatch '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') { throw "Bounds invalidos: $bounds" }
  $x = [int](($matches[1] + $matches[3]) / 2)
  $y = [int](($matches[2] + $matches[4]) / 2)
  Invoke-Native $Adb @('shell', 'input', 'tap', "$x", "$y")
}

function Find-And-Tap {
  param([string]$Adb, [string[]]$Candidates, [string]$Name, [int]$Scrolls = 0)
  for ($i = 0; $i -le $Scrolls; $i++) {
    $xml = Dump-Ui -Adb $Adb -Name "$Name-$i"
    $node = Find-UiNode -Xml $xml -Candidates $Candidates
    if ($node) {
      Tap-Node -Adb $Adb -Node $node
      return $true
    }
    if ($i -lt $Scrolls) {
      Invoke-Native $Adb @('shell', 'input', 'swipe', '540', '1750', '540', '650', '350')
      Start-Sleep 1
    }
  }
  return $false
}

function Wait-ForText {
  param([string]$Adb, [string[]]$Candidates, [int]$Seconds = 20, [string]$Name = 'wait')
  $deadline = (Get-Date).AddSeconds($Seconds)
  $n = 0
  do {
    Start-Sleep 2
    $xml = Dump-Ui -Adb $Adb -Name "$Name-$n"
    if (Find-UiNode -Xml $xml -Candidates $Candidates) { return $true }
    $n++
  } until ((Get-Date) -gt $deadline)
  return $false
}

function Capture-Screen {
  param([string]$Path)
  if (-not $script:adbPath) { return }
  $remote = '/sdcard/qa-screen.png'
  Invoke-Native $script:adbPath @('shell', 'screencap', '-p', $remote)
  Invoke-Native $script:adbPath @('pull', $remote, $Path)
}

function Assert-AppLoaded {
  param([string]$Adb)
  $xml = Dump-Ui -Adb $Adb -Name 'app-loaded'
  if (Find-UiNode -Xml $xml -Candidates @('There was a problem loading the project.')) {
    $reload = Find-UiNode -Xml $xml -Candidates @('Reload')
    if ($reload) { Tap-Node -Adb $Adb -Node $reload; Start-Sleep 8; $xml = Dump-Ui -Adb $Adb -Name 'app-reloaded' }
  }
  if (Find-UiNode -Xml $xml -Candidates @('There was a problem loading the project.')) { throw 'Development build ainda sem Metro.' }
  foreach ($label in @('Hoje', 'Inbox', 'Radar', 'Planejar', 'Mais')) {
    if (-not (Find-UiNode -Xml $xml -Candidates @($label))) { throw "Navegacao '$label' nao encontrada no APK." }
  }
}

function Test-RevenueCatFlow {
  param([string]$Adb)
  if (-not (Find-And-Tap -Adb $Adb -Candidates @('Mais') -Name 'nav-more')) { throw 'Aba Mais nao encontrada.' }
  Start-Sleep 4

  $proNow = Wait-ForText -Adb $Adb -Candidates @('Plano Pro ativo', 'Gerenciar assinatura real') -Seconds 3 -Name 'pro-before'
  if (-not $proNow) {
    $opened = Find-And-Tap -Adb $Adb -Candidates @('Ver assinatura Pro', 'Assinar Pro', 'Gerenciar assinatura') -Name 'open-plan' -Scrolls 5
    if (-not $opened) { throw 'Acao de assinatura nao encontrada na tela Mais.' }
    Start-Sleep 5
    Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-paywall.png')

    $valid = Find-And-Tap -Adb $Adb -Candidates @('TEST VALID PURCHASE') -Name 'test-valid-direct' -Scrolls 2
    if (-not $valid) {
      $purchase = Find-And-Tap -Adb $Adb -Candidates @('Test Store Purchase', 'Subscribe', 'Continue', 'Get Pro', 'Upgrade', 'Assinar') -Name 'purchase-action' -Scrolls 3
      if (-not $purchase) { throw 'Botao de compra do paywall nao encontrado.' }
      Start-Sleep 3
      $valid = Find-And-Tap -Adb $Adb -Candidates @('TEST VALID PURCHASE') -Name 'test-valid' -Scrolls 2
    }
    if (-not $valid) { throw 'TEST VALID PURCHASE nao apareceu.' }
    Start-Sleep 8
  }

  Invoke-Native $Adb @('shell', 'am', 'force-stop', 'com.engenutri.wheresthemoney')
  Invoke-Native $Adb @('shell', 'monkey', '-p', 'com.engenutri.wheresthemoney', '-c', 'android.intent.category.LAUNCHER', '1')
  Start-Sleep 8
  Assert-AppLoaded -Adb $Adb
  if (-not (Find-And-Tap -Adb $Adb -Candidates @('Mais') -Name 'nav-more-after')) { throw 'Aba Mais nao encontrada apos reabrir.' }
  Start-Sleep 4
  if (-not (Wait-ForText -Adb $Adb -Candidates @('Plano Pro ativo', 'Gerenciar assinatura real') -Seconds 15 -Name 'pro-after')) {
    throw 'RevenueCat nao manteve o estado Pro apos compra/reabertura.'
  }
  Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-pro.png')

  $restored = Find-And-Tap -Adb $Adb -Candidates @('Restaurar', 'Restaurar compra', 'Restore purchases') -Name 'restore' -Scrolls 4
  if ($restored) {
    Start-Sleep 5
    if (-not (Wait-ForText -Adb $Adb -Candidates @('Plano Pro ativo', 'Gerenciar assinatura real') -Seconds 10 -Name 'restore-pro')) {
      throw 'Restore Purchases nao preservou Pro.'
    }
  }
}

try {
  $hasMutex = $mutex.WaitOne([TimeSpan]::FromMinutes(20))
  if (-not $hasMutex) { throw 'Timeout aguardando exclusividade do Android QA.' }

  Invoke-Flow 'trusted-host-and-secrets' {
    Copy-LocalSecrets
    Write-Host "Secrets carregados a partir do host confiavel; valores nao exibidos."
  }

  $tools = Get-AndroidTools
  $script:adbPath = $tools.adb

  Invoke-Flow 'android-emulator' {
    Ensure-Emulator -Adb $tools.adb -Emulator $tools.emulator
    Invoke-Native $tools.adb @('devices')
  }

  Invoke-Flow 'metro' {
    Start-Metro -Adb $tools.adb
  }

  Invoke-Flow 'android-build-install' {
    Push-Location 'apps/mobile'
    try { Invoke-Native 'npx' @('expo', 'run:android', '--no-bundler') } finally { Pop-Location }
    Start-Sleep 8
  }

  Invoke-Flow 'android-smoke' {
    Assert-AppLoaded -Adb $tools.adb
    Capture-Screen -Path (Join-Path $artifactDir 'android-home.png')
  }

  Invoke-Flow 'deployed-integrations' {
    $status = Invoke-RestMethod 'https://hackathon.nutricionistaalmeidavh.workers.dev/api/integrations/status' -TimeoutSec 30
    if (-not $status.openFinance.configured) { throw 'Pluggy/Open Finance nao esta configurado no Worker publicado.' }
    if (-not $status.ai.configured) { throw 'Gemini nao esta configurado no Worker publicado.' }
    $status | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $artifactDir 'integrations-status.json') -Encoding utf8
  }

  Invoke-Flow 'revenuecat-e2e' {
    Test-RevenueCatFlow -Adb $tools.adb
  }

  Save-Summary
  Write-Host "`nHackathon Android QA: PASS" -ForegroundColor Green
} finally {
  if (-not (Test-Path $qaPath)) { Save-Summary }
  if ($metroProcess -and -not $metroProcess.HasExited) {
    Stop-Process -Id $metroProcess.Id -Force -ErrorAction SilentlyContinue
  }
  try {
    New-Item -ItemType Directory -Force -Path $persistDir | Out-Null
    Copy-Item (Join-Path $artifactDir '*') $persistDir -Recurse -Force -ErrorAction SilentlyContinue
  } catch {}
  if ($hasMutex) { try { $mutex.ReleaseMutex() } catch {} }
  $mutex.Dispose()
}
