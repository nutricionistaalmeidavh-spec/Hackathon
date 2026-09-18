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
$adbPath = $null
$mutex = New-Object System.Threading.Mutex($false, 'ArtiSysHackathonAndroidQA')
$hasMutex = $false

$secretSource = if ($env:ARTISYS_HACKATHON_SECRETS_SOURCE) { $env:ARTISYS_HACKATHON_SECRETS_SOURCE } else { 'C:\Users\Marcio\StudioProjects\Hackathon' }
$persistRoot = if ($env:ARTISYS_HACKATHON_QA_ROOT) { $env:ARTISYS_HACKATHON_QA_ROOT } else { 'C:\VICTOR\Hackathon-QA\woodpecker' }
$runKey = if ($env:CI_COMMIT_SHA) { $env:CI_COMMIT_SHA.Substring(0, [Math]::Min(12, $env:CI_COMMIT_SHA.Length)) } else { Get-Date -Format 'yyyyMMdd-HHmmss' }
$persistDir = Join-Path $persistRoot $runKey
New-Item -ItemType Directory -Force -Path $persistDir | Out-Null

function Save-Summary {
  $passed = @($script:flows | Where-Object status -eq 'PASS').Count
  $failed = @($script:flows | Where-Object status -eq 'FAIL').Count
  [pscustomobject]@{
    status = if ($failed) { 'FAIL' } else { 'PASS' }
    counts = @{ flowsPassed = $passed; flowsFailed = $failed }
    flows = $script:flows
  } | ConvertTo-Json -Depth 10 | Set-Content -Path $qaPath -Encoding utf8
}

function Add-Result {
  param([string]$Name, [string]$Status, [string]$Error = '', [string]$Screenshot = '')
  $evidence = @{ runSummary = $qaPath; outputDir = $persistDir }
  if ($Screenshot) { $evidence.screenshot = $Screenshot }
  $script:flows += [pscustomobject]@{ flow = $Name; status = $Status; error = $Error; evidence = $evidence }
}

function Invoke-Native {
  param([string]$Exe, [string[]]$Args = @())
  & $Exe @Args *>&1 | Tee-Object -FilePath $logPath -Append
  if ($LASTEXITCODE -ne 0) { throw "$Exe terminou com exit code $LASTEXITCODE" }
}

function Capture-Screen {
  param([string]$Path)
  if (-not $script:adbPath) { return }
  $remote = '/sdcard/qa-screen.png'
  Invoke-Native $script:adbPath @('shell', 'screencap', '-p', $remote)
  Invoke-Native $script:adbPath @('pull', $remote, $Path)
}

function Invoke-Flow {
  param([string]$Name, [scriptblock]$Action)
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  try {
    & $Action
    Add-Result -Name $Name -Status 'PASS'
    Save-Summary
  } catch {
    $shot = Join-Path $artifactDir 'failure.png'
    try { Capture-Screen $shot } catch {}
    try { Copy-Item $shot (Join-Path $persistDir 'failure.png') -Force -ErrorAction SilentlyContinue } catch {}
    $persistShot = Join-Path $persistDir 'failure.png'
    Add-Result -Name $Name -Status 'FAIL' -Error $_.Exception.Message -Screenshot $persistShot
    Save-Summary
    throw
  }
}

function Copy-TrustedSecrets {
  $mobileSource = Join-Path $secretSource 'apps\mobile\.env'
  $workerSource = Join-Path $secretSource '.dev.vars'
  $mobileTarget = Join-Path $repo 'apps\mobile\.env'
  $workerTarget = Join-Path $repo '.dev.vars'

  if (-not (Test-Path $mobileSource)) { throw "Mobile .env nao encontrado no host confiavel: $mobileSource" }
  Copy-Item $mobileSource $mobileTarget -Force
  if (Test-Path $workerSource) { Copy-Item $workerSource $workerTarget -Force }

  $lines = Get-Content $mobileTarget
  if (-not ($lines -match '^EXPO_PUBLIC_REVENUECAT_API_KEY=.+')) { throw 'REVENUECAT_API_KEY ausente.' }
  if (-not ($lines -match '^EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro$')) { throw 'RevenueCat entitlement precisa ser pro.' }
}

function Get-Tools {
  if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'C:\Users\Marcio\AppData\Local\Android\Sdk' }
  $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
  $emu = Join-Path $env:ANDROID_HOME 'emulator\emulator.exe'
  if (-not (Test-Path $adb)) { throw "adb nao encontrado: $adb" }
  if (-not (Test-Path $emu)) { throw "emulator nao encontrado: $emu" }
  @{ adb = $adb; emulator = $emu }
}

function Ensure-Emulator {
  param([string]$Adb, [string]$Emulator)
  Invoke-Native $Adb @('start-server')
  $devices = & $Adb devices
  if (-not ($devices -match 'emulator-\d+\s+device')) {
    $avds = & $Emulator -list-avds
    $avd = $avds | Where-Object { $_ -eq 'Pixel_9' } | Select-Object -First 1
    if (-not $avd) { $avd = $avds | Select-Object -First 1 }
    if (-not $avd) { throw 'Nenhum AVD encontrado.' }
    Start-Process $Emulator -ArgumentList @('-avd', $avd, '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot-save', '-gpu', 'swiftshader_indirect') | Out-Null
  }

  $deadline = (Get-Date).AddMinutes(4)
  do {
    Start-Sleep 3
    $devices = & $Adb devices
  } until (($devices -match 'emulator-\d+\s+device') -or (Get-Date) -gt $deadline)
  if (-not ($devices -match 'emulator-\d+\s+device')) { throw 'Emulador nao apareceu no adb.' }

  do {
    Start-Sleep 3
    $boot = (& $Adb shell getprop sys.boot_completed 2>$null).Trim()
  } until ($boot -eq '1' -or (Get-Date) -gt $deadline)
  if ($boot -ne '1') { throw 'Boot do Android nao terminou.' }
}

function Start-Metro {
  param([string]$Adb)
  Invoke-Native $Adb @('reverse', 'tcp:8081', 'tcp:8081')
  $metroLog = Join-Path $artifactDir 'metro.log'
  $mobile = Join-Path $repo 'apps\mobile'
  $cmd = "Set-Location '$mobile'; npx expo start --dev-client --localhost --port 8081 *> '$metroLog'"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
  $script:metroProcess = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList '-NoProfile', '-EncodedCommand', $encoded
  $deadline = (Get-Date).AddSeconds(90)
  do {
    Start-Sleep 2
    $ready = (Test-NetConnection 127.0.0.1 -Port 8081 -WarningAction SilentlyContinue).TcpTestSucceeded
  } until ($ready -or (Get-Date) -gt $deadline)
  if (-not $ready) { throw "Metro nao abriu porta 8081; veja $metroLog" }
}

function Dump-Ui {
  param([string]$Adb, [string]$Name)
  $remote = '/sdcard/window.xml'
  $local = Join-Path $artifactDir "$Name.xml"
  $ok = $false
  for ($i = 0; $i -lt 3; $i++) {
    & $Adb shell uiautomator dump $remote | Out-Null
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Start-Sleep 2
  }
  if (-not $ok) { throw 'uiautomator dump falhou.' }
  Invoke-Native $Adb @('pull', $remote, $local)
  [xml](Get-Content $local -Raw)
}

function Find-Node {
  param([xml]$Xml, [string[]]$Candidates)
  foreach ($candidate in $Candidates) {
    $found = $Xml.SelectNodes('//node') | Where-Object {
      $text = $_.GetAttribute('text')
      $desc = $_.GetAttribute('content-desc')
      $text -eq $candidate -or $desc -eq $candidate -or $text -like "*$candidate*" -or $desc -like "*$candidate*"
    } | Select-Object -First 1
    if ($found) { return $found }
  }
  $null
}

function Tap-Node {
  param([string]$Adb, $Node)
  $bounds = $Node.GetAttribute('bounds')
  if ($bounds -notmatch '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') { throw "Bounds invalidos: $bounds" }
  $x1 = [int]$matches[1]; $y1 = [int]$matches[2]; $x2 = [int]$matches[3]; $y2 = [int]$matches[4]
  $x = [int](($x1 + $x2) / 2); $y = [int](($y1 + $y2) / 2)
  Invoke-Native $Adb @('shell', 'input', 'tap', "$x", "$y")
}

function Find-And-Tap {
  param([string]$Adb, [string[]]$Candidates, [string]$Name, [int]$Scrolls = 0)
  for ($i = 0; $i -le $Scrolls; $i++) {
    $xml = Dump-Ui $Adb "$Name-$i"
    $node = Find-Node $xml $Candidates
    if ($node) { Tap-Node $Adb $node; return $true }
    if ($i -lt $Scrolls) {
      Invoke-Native $Adb @('shell', 'input', 'swipe', '540', '1750', '540', '650', '350')
      Start-Sleep 1
    }
  }
  $false
}

function Wait-Text {
  param([string]$Adb, [string[]]$Candidates, [int]$Seconds = 20, [string]$Name = 'wait')
  $deadline = (Get-Date).AddSeconds($Seconds); $n = 0
  do {
    Start-Sleep 2
    $xml = Dump-Ui $Adb "$Name-$n"
    if (Find-Node $xml $Candidates) { return $true }
    $n++
  } until ((Get-Date) -gt $deadline)
  $false
}

function Assert-AppLoaded {
  param([string]$Adb)
  $xml = Dump-Ui $Adb 'app-loaded'
  if (Find-Node $xml @('There was a problem loading the project.')) {
    $reload = Find-Node $xml @('Reload')
    if ($reload) { Tap-Node $Adb $reload; Start-Sleep 8; $xml = Dump-Ui $Adb 'app-reloaded' }
  }
  if (Find-Node $xml @('There was a problem loading the project.')) { throw 'Development build sem conexao com Metro.' }
  foreach ($label in @('Hoje', 'Inbox', 'Radar', 'Planejar', 'Mais')) {
    if (-not (Find-Node $xml @($label))) { throw "Navegacao '$label' nao encontrada." }
  }
}

function Test-RevenueCat {
  param([string]$Adb)
  if (-not (Find-And-Tap $Adb @('Mais') 'nav-more')) { throw 'Aba Mais nao encontrada.' }
  Start-Sleep 4

  $alreadyPro = Wait-Text $Adb @('Plano Pro ativo', 'Gerenciar assinatura real') 3 'pro-before'
  if (-not $alreadyPro) {
    if (-not (Find-And-Tap $Adb @('Ver assinatura Pro', 'Assinar Pro', 'Gerenciar assinatura') 'open-plan' 5)) { throw 'Acao de assinatura nao encontrada.' }
    Start-Sleep 5
    Capture-Screen (Join-Path $artifactDir 'revenuecat-paywall.png')

    $valid = Find-And-Tap $Adb @('TEST VALID PURCHASE') 'valid-direct' 2
    if (-not $valid) {
      $purchase = Find-And-Tap $Adb @('Test Store Purchase', 'Subscribe', 'Continue', 'Get Pro', 'Upgrade', 'Assinar') 'purchase' 3
      if (-not $purchase) { throw 'Acao de compra do paywall nao encontrada.' }
      Start-Sleep 3
      $valid = Find-And-Tap $Adb @('TEST VALID PURCHASE') 'valid-after-purchase' 2
    }
    if (-not $valid) { throw 'TEST VALID PURCHASE nao apareceu.' }
    Start-Sleep 8
  }

  Invoke-Native $Adb @('shell', 'am', 'force-stop', 'com.engenutri.wheresthemoney')
  Invoke-Native $Adb @('shell', 'monkey', '-p', 'com.engenutri.wheresthemoney', '-c', 'android.intent.category.LAUNCHER', '1')
  Start-Sleep 8
  Assert-AppLoaded $Adb
  if (-not (Find-And-Tap $Adb @('Mais') 'nav-more-after')) { throw 'Aba Mais nao encontrada apos reabrir.' }
  Start-Sleep 4
  if (-not (Wait-Text $Adb @('Plano Pro ativo', 'Gerenciar assinatura real') 15 'pro-after')) { throw 'Estado Pro nao persistiu apos compra/reabertura.' }
  Capture-Screen (Join-Path $artifactDir 'revenuecat-pro.png')

  if (-not (Find-And-Tap $Adb @('Restaurar compra', 'Restaurar', 'Restore purchases') 'restore' 4)) { throw 'Acao Restaurar nao encontrada.' }
  Start-Sleep 5
  if (-not (Wait-Text $Adb @('Plano Pro ativo', 'Gerenciar assinatura real') 10 'restore-pro')) { throw 'Restore Purchases nao preservou Pro.' }
}

try {
  $hasMutex = $mutex.WaitOne([TimeSpan]::FromMinutes(20))
  if (-not $hasMutex) { throw 'Timeout aguardando Android QA.' }

  Invoke-Flow 'trusted-host-and-secrets' { Copy-TrustedSecrets }

  $tools = Get-Tools
  $script:adbPath = $tools.adb

  Invoke-Flow 'android-emulator' {
    Ensure-Emulator $tools.adb $tools.emulator
    Invoke-Native $tools.adb @('devices')
  }

  Invoke-Flow 'metro' { Start-Metro $tools.adb }

  Invoke-Flow 'android-build-install' {
    Push-Location 'apps/mobile'
    try { Invoke-Native 'npx' @('expo', 'run:android', '--no-bundler') } finally { Pop-Location }
    Start-Sleep 8
  }

  Invoke-Flow 'android-smoke' {
    Assert-AppLoaded $tools.adb
    Capture-Screen (Join-Path $artifactDir 'android-home.png')
  }

  Invoke-Flow 'deployed-integrations' {
    $status = Invoke-RestMethod 'https://hackathon.nutricionistaalmeidavh.workers.dev/api/integrations/status' -TimeoutSec 30
    if (-not $status.openFinance.configured) { throw 'Pluggy/Open Finance nao configurado no Worker publicado.' }
    if (-not $status.ai.configured) { throw 'Gemini nao configurado no Worker publicado.' }
    $status | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $artifactDir 'integrations-status.json') -Encoding utf8
  }

  Invoke-Flow 'revenuecat-e2e' { Test-RevenueCat $tools.adb }

  Save-Summary
  Write-Host "`nHackathon Android QA: PASS" -ForegroundColor Green
} finally {
  if (-not (Test-Path $qaPath)) { Save-Summary }
  if ($metroProcess -and -not $metroProcess.HasExited) { Stop-Process -Id $metroProcess.Id -Force -ErrorAction SilentlyContinue }
  try { Copy-Item (Join-Path $artifactDir '*') $persistDir -Recurse -Force -ErrorAction SilentlyContinue } catch {}
  if ($hasMutex) { try { $mutex.ReleaseMutex() } catch {} }
  $mutex.Dispose()
}
