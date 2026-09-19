param()

$ErrorActionPreference = 'Stop'
$env:CI = 'true'
$env:EXPO_PUBLIC_QA_AUTOMATION = '1'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$metroRepo = if ($env:ARTISYS_HACKATHON_METRO_SOURCE) {
  (Resolve-Path $env:ARTISYS_HACKATHON_METRO_SOURCE).Path
} else {
  $repo
}

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
$runKey = if ($env:CI_COMMIT_SHA) {
  $env:CI_COMMIT_SHA.Substring(0, [Math]::Min(12, $env:CI_COMMIT_SHA.Length))
} else {
  Get-Date -Format 'yyyyMMdd-HHmmss'
}
$persistDir = Join-Path $persistRoot $runKey
New-Item -ItemType Directory -Force -Path $persistDir | Out-Null

if (-not $env:DOTSLASH_CACHE) {
  $env:DOTSLASH_CACHE = Join-Path $env:TEMP 'artisys-dotslash-cache'
}
New-Item -ItemType Directory -Force -Path $env:DOTSLASH_CACHE | Out-Null

function Save-Summary {
  $passed = @($script:flows | Where-Object status -eq 'PASS').Count
  $failed = @($script:flows | Where-Object status -eq 'FAIL').Count
  [pscustomobject]@{
    status = if ($failed) { 'FAIL' } else { 'PASS' }
    counts = @{ flowsPassed = $passed; flowsFailed = $failed }
    flows = $script:flows
  } | ConvertTo-Json -Depth 12 | Set-Content -Path $qaPath -Encoding utf8
}

function Add-Result {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Error = '',
    [string]$Command = '',
    [Nullable[int]]$ExitCode = $null,
    [string]$Screenshot = ''
  )

  $evidence = @{
    runSummary = $qaPath
    outputDir = $persistDir
  }
  if ($Screenshot) { $evidence.screenshot = $Screenshot }

  $script:flows += [pscustomobject]@{
    flow = $Name
    status = $Status
    error = $Error
    failedStep = if ($Status -eq 'FAIL') {
      @{
        name = $Name
        action = $Command
        error = $Error
        exitCode = $ExitCode
      }
    } else {
      $null
    }
    evidence = $evidence
  }
}

function Write-LoggedOutput {
  param($Output)
  foreach ($line in @($Output)) {
    $text = [string]$line
    Write-Host $text
    Add-Content -Path $logPath -Value $text -Encoding utf8
  }
}

function Invoke-Native {
  param(
    [string]$Exe,
    [string[]]$Arguments = @(),
    [string]$WorkingDirectory = ''
  )

  $commandText = "$Exe $($Arguments -join ' ')".Trim()
  Add-Content -Path $logPath -Value "`n> $commandText" -Encoding utf8

  $oldPreference = $ErrorActionPreference
  $output = @()
  $exitCode = $null

  try {
    if ($WorkingDirectory) { Push-Location $WorkingDirectory }
    $ErrorActionPreference = 'Continue'
    $output = @(& $Exe @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
  } catch {
    $output += $_.Exception.Message
    if ($null -eq $exitCode) { $exitCode = 1 }
  } finally {
    $ErrorActionPreference = $oldPreference
    if ($WorkingDirectory) { Pop-Location }
  }

  Write-LoggedOutput $output
  Add-Content -Path $logPath -Value "exit=$exitCode" -Encoding utf8

  if ($exitCode -ne 0) {
    $tail = (@($output) | Select-Object -Last 35 | ForEach-Object { [string]$_ }) -join "`n"
    throw "$commandText falhou (exit $exitCode): $tail"
  }

  return ,$output
}

function Capture-Screen {
  param([string]$Path)
  if (-not $script:adbPath) { return }

  $remote = '/sdcard/qa-screen.png'
  Invoke-Native -Exe $script:adbPath -Arguments @('shell','screencap','-p',$remote) | Out-Null
  Invoke-Native -Exe $script:adbPath -Arguments @('pull',$remote,$Path) | Out-Null
}

function Invoke-Flow {
  param([string]$Name,[scriptblock]$Action)

  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  Add-Content -Path $logPath -Value "`n=== $Name ===" -Encoding utf8

  try {
    & $Action
    Add-Result -Name $Name -Status 'PASS'
    Save-Summary
  } catch {
    $shot = Join-Path $artifactDir 'failure.png'
    try { Capture-Screen -Path $shot } catch {}

    $persistShot = ''
    if (Test-Path $shot) {
      $persistShot = Join-Path $persistDir 'failure.png'
      try { Copy-Item $shot $persistShot -Force } catch {}
    }

    $message = $_.Exception.Message
    Add-Content -Path $logPath -Value "FAIL: $message" -Encoding utf8
    Add-Result -Name $Name -Status 'FAIL' -Error $message -Command $Name -ExitCode 1 -Screenshot $persistShot
    Save-Summary
    throw
  }
}

function Copy-FileUnlessSame {
  param([string]$Source,[string]$Target)

  $sourceFull = [IO.Path]::GetFullPath($Source)
  $targetFull = [IO.Path]::GetFullPath($Target)

  if ($sourceFull -ieq $targetFull) { return }

  $targetDir = Split-Path -Parent $Target
  if ($targetDir) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  }
  Copy-Item $Source $Target -Force
}

function Copy-TrustedSecrets {
  $mobileSource = Join-Path $secretSource 'apps\mobile\.env'
  $workerSource = Join-Path $secretSource '.dev.vars'

  $mobileTargetShort = Join-Path $repo 'apps\mobile\.env'
  $mobileTargetMetro = Join-Path $metroRepo 'apps\mobile\.env'
  $workerTarget = Join-Path $repo '.dev.vars'

  if (-not (Test-Path $mobileSource)) {
    throw "Mobile .env nao encontrado no host confiavel: $mobileSource"
  }

  Copy-FileUnlessSame -Source $mobileSource -Target $mobileTargetShort
  Copy-FileUnlessSame -Source $mobileSource -Target $mobileTargetMetro

  if (Test-Path $workerSource) {
    Copy-FileUnlessSame -Source $workerSource -Target $workerTarget
  }

  $lines = Get-Content $mobileTargetShort
  if (-not ($lines -match '^EXPO_PUBLIC_REVENUECAT_API_KEY=.+')) {
    throw 'EXPO_PUBLIC_REVENUECAT_API_KEY ausente.'
  }
  if (-not ($lines -match '^EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro$')) {
    throw 'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID precisa ser pro.'
  }
  if ($env:EXPO_PUBLIC_QA_AUTOMATION -ne '1') {
    throw 'EXPO_PUBLIC_QA_AUTOMATION precisa ser 1 no QA Android.'
  }

  Write-Host "Secrets locais carregados sem exibir valores; Metro source: $metroRepo"
}

function Ensure-MetroDependencies {
  $mobile = Join-Path $metroRepo 'apps\mobile'
  $expoPackage = Join-Path $mobile 'node_modules\expo\package.json'

  if (Test-Path $expoPackage) {
    Write-Host 'Dependencias do Metro ja disponiveis no workspace original.'
    return
  }

  Write-Host 'Instalando dependencias do Metro no workspace original.'
  Invoke-Native -Exe 'npm.cmd' -Arguments @('ci','--no-audit','--no-fund') -WorkingDirectory $mobile | Out-Null
}

function Get-Tools {
  if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = 'C:\Users\Marcio\AppData\Local\Android\Sdk'
  }

  $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
  $emu = Join-Path $env:ANDROID_HOME 'emulator\emulator.exe'

  if (-not (Test-Path $adb)) { throw "adb nao encontrado: $adb" }
  if (-not (Test-Path $emu)) { throw "emulator nao encontrado: $emu" }

  return @{ adb = $adb; emulator = $emu }
}

function Get-AdbDevices {
  param([string]$Adb)

  $oldPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    return @(& $Adb devices 2>&1)
  } finally {
    $ErrorActionPreference = $oldPreference
  }
}

function Ensure-Emulator {
  param([string]$Adb,[string]$Emulator)

  Invoke-Native -Exe $Adb -Arguments @('start-server') | Out-Null
  $devices = Get-AdbDevices -Adb $Adb

  if (-not ($devices -match 'emulator-\d+\s+device')) {
    $avds = @(& $Emulator -list-avds)
    $avd = $avds | Where-Object { $_ -eq 'Pixel_9' } | Select-Object -First 1
    if (-not $avd) { $avd = $avds | Select-Object -First 1 }
    if (-not $avd) { throw 'Nenhum AVD Android encontrado.' }

    Write-Host "Iniciando AVD $avd em modo headless."
    Start-Process $Emulator -ArgumentList @(
      '-avd',$avd,
      '-no-window',
      '-no-audio',
      '-no-boot-anim',
      '-no-snapshot-save',
      '-gpu','swiftshader_indirect'
    ) | Out-Null
  }

  $deadline = (Get-Date).AddMinutes(5)
  do {
    Start-Sleep 3
    $devices = Get-AdbDevices -Adb $Adb
  } until (($devices -match 'emulator-\d+\s+device') -or (Get-Date) -gt $deadline)

  if (-not ($devices -match 'emulator-\d+\s+device')) {
    throw 'Emulador nao apareceu no adb.'
  }

  $boot = ''
  do {
    Start-Sleep 3
    $oldPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $boot = ((& $Adb shell getprop sys.boot_completed 2>$null) -join '').Trim()
    } finally {
      $ErrorActionPreference = $oldPreference
    }
  } until ($boot -eq '1' -or (Get-Date) -gt $deadline)

  if ($boot -ne '1') {
    throw 'Android nao concluiu o boot.'
  }

  Write-LoggedOutput $devices
}

function Clear-StaleMetro {
  $listeners = @(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue)

  foreach ($listener in $listeners) {
    $ownerPid = $listener.OwningProcess
    if ($ownerPid -and $ownerPid -ne $PID) {
      Write-Host "Encerrando Metro obsoleto na porta 8081 (PID $ownerPid)." -ForegroundColor Yellow
      Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
    }
  }

  Start-Sleep 2

  if (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Porta 8081 continua ocupada antes do Metro do QA.'
  }
}

function Get-MetroStatus {
  try {
    $response = Invoke-WebRequest 'http://localhost:8081/status' -UseBasicParsing -TimeoutSec 3
    $content = $response.Content

    if ($content -is [byte[]]) {
      $content = [Text.Encoding]::UTF8.GetString($content)
    } else {
      $content = [string]$content
    }

    return [pscustomobject]@{
      ready = ($response.StatusCode -eq 200 -and $content.Trim() -eq 'packager-status:running')
      statusCode = $response.StatusCode
      content = $content.Trim()
      error = ''
    }
  } catch {
    return [pscustomobject]@{
      ready = $false
      statusCode = $null
      content = ''
      error = $_.Exception.Message
    }
  }
}

function Start-Metro {
  param([string]$Adb)

  Clear-StaleMetro
  Ensure-MetroDependencies
  Invoke-Native -Exe $Adb -Arguments @('reverse','tcp:8081','tcp:8081') | Out-Null

  $metroLog = Join-Path $artifactDir 'metro.log'
  $mobile = Join-Path $metroRepo 'apps\mobile'
  $dotslash = $env:DOTSLASH_CACHE

  $cmd = @"
Set-Location '$mobile'
`$env:CI='true'
`$env:EXPO_PUBLIC_QA_AUTOMATION='1'
`$env:REACT_NATIVE_PACKAGER_HOSTNAME='127.0.0.1'
`$env:DOTSLASH_CACHE='$dotslash'
npx.cmd expo start --dev-client --localhost --port 8081 --clear *> '$metroLog'
"@

  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
  $script:metroProcess = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList @(
    '-NoProfile',
    '-EncodedCommand',
    $encoded
  )

  Write-Host "Metro iniciado no workspace original: $mobile (PID $($script:metroProcess.Id))"

  $deadline = (Get-Date).AddSeconds(120)
  $lastStatus = $null

  do {
    Start-Sleep 2
    $lastStatus = Get-MetroStatus

    if ($lastStatus.ready) {
      Write-Host "Metro readiness PASS: HTTP $($lastStatus.statusCode) $($lastStatus.content)" -ForegroundColor Green
      return
    }

    if ($script:metroProcess.HasExited) {
      break
    }
  } until ((Get-Date) -gt $deadline)

  $tail = if (Test-Path $metroLog) {
    (Get-Content $metroLog -Tail 60) -join "`n"
  } else {
    'metro.log ausente'
  }

  $diag = if ($lastStatus) {
    "HTTP=$($lastStatus.statusCode) content='$($lastStatus.content)' error='$($lastStatus.error)'"
  } else {
    'status nao consultado'
  }

  throw "Metro nao ficou pronto. $diag`n$tail"
}

function Dump-Ui {
  param([string]$Adb,[string]$Name)

  $remote = '/sdcard/window.xml'
  $local = Join-Path $artifactDir "$Name.xml"
  $ok = $false

  for ($i = 0; $i -lt 3; $i++) {
    $oldPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      & $Adb shell uiautomator dump $remote | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $ok = $true
        break
      }
    } finally {
      $ErrorActionPreference = $oldPreference
    }
    Start-Sleep 2
  }

  if (-not $ok) { throw 'uiautomator dump falhou.' }

  Invoke-Native -Exe $Adb -Arguments @('pull',$remote,$local) | Out-Null
  Copy-Item $local (Join-Path $persistDir "$Name.xml") -Force -ErrorAction SilentlyContinue

  return [xml](Get-Content $local -Raw)
}

function Find-Node {
  param([xml]$Xml,[string[]]$Candidates)

  foreach ($candidate in $Candidates) {
    $found = $Xml.SelectNodes('//node') | Where-Object {
      $text = $_.GetAttribute('text')
      $desc = $_.GetAttribute('content-desc')
      $text -eq $candidate -or
      $desc -eq $candidate -or
      $text -like "*$candidate*" -or
      $desc -like "*$candidate*"
    } | Select-Object -First 1

    if ($found) { return $found }
  }

  return $null
}

function Tap-Node {
  param([string]$Adb,$Node)

  $bounds = $Node.GetAttribute('bounds')
  if ($bounds -notmatch '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
    throw "Bounds invalidos: $bounds"
  }

  $x = [int](([int]$matches[1] + [int]$matches[3]) / 2)
  $y = [int](([int]$matches[2] + [int]$matches[4]) / 2)

  Invoke-Native -Exe $Adb -Arguments @('shell','input','tap',"$x","$y") | Out-Null
}

function Find-And-Tap {
  param(
    [string]$Adb,
    [string[]]$Candidates,
    [string]$Name,
    [int]$Scrolls = 0
  )

  for ($i = 0; $i -le $Scrolls; $i++) {
    $xml = Dump-Ui -Adb $Adb -Name "$Name-$i"
    $node = Find-Node -Xml $xml -Candidates $Candidates

    if ($node) {
      Tap-Node -Adb $Adb -Node $node
      return $true
    }

    if ($i -lt $Scrolls) {
      Invoke-Native -Exe $Adb -Arguments @('shell','input','swipe','540','1750','540','650','350') | Out-Null
      Start-Sleep 1
    }
  }

  return $false
}

function Wait-Text {
  param(
    [string]$Adb,
    [string[]]$Candidates,
    [int]$Seconds = 20,
    [string]$Name = 'wait'
  )

  $deadline = (Get-Date).AddSeconds($Seconds)
  $n = 0

  do {
    Start-Sleep 2
    $xml = Dump-Ui -Adb $Adb -Name "$Name-$n"

    if (Find-Node -Xml $xml -Candidates $Candidates) {
      return $true
    }

    $n++
  } until ((Get-Date) -gt $deadline)

  return $false
}

function Assert-AppLoaded {
  param([string]$Adb)

  $deadline = (Get-Date).AddSeconds(75)
  $last = 'UI nativa ainda nao carregou.'

  do {
    try {
      $xml = Dump-Ui -Adb $Adb -Name 'app-loaded'

      if (Find-Node -Xml $xml -Candidates @('There was a problem loading the project.')) {
        $reload = Find-Node -Xml $xml -Candidates @('Reload')
        if ($reload) {
          Tap-Node -Adb $Adb -Node $reload
          Start-Sleep 8
          $xml = Dump-Ui -Adb $Adb -Name 'app-reloaded'
        }
      }

      if (Find-Node -Xml $xml -Candidates @('There was a problem loading the project.')) {
        $last = 'Development build ainda sem conexao com Metro.'
      } else {
        $missing = @()

        foreach ($label in @('Hoje','Inbox','Radar','Planejar','Mais')) {
          if (-not (Find-Node -Xml $xml -Candidates @($label))) {
            $missing += $label
          }
        }

        if ($missing.Count -eq 0) { return }
        $last = "Navegacao ainda ausente: $($missing -join ', ')"
      }
    } catch {
      $last = $_.Exception.Message
    }

    Start-Sleep 5
  } until ((Get-Date) -gt $deadline)

  $visible = ''
  try {
    $diag = Dump-Ui -Adb $Adb -Name 'app-smoke-final'
    $visible = @(
      $diag.SelectNodes('//node') | ForEach-Object {
        $t = $_.GetAttribute('text')
        $d = $_.GetAttribute('content-desc')
        if ($t) { $t } elseif ($d) { $d }
      } | Where-Object { $_ } | Select-Object -Unique
    ) -join ' | '
  } catch {}

  throw "$last UI visivel: $visible"
}

function Get-RevenueCatQaState {
  param([string]$Adb,[string]$Name)

  $xml = Dump-Ui -Adb $Adb -Name $Name

  if (Find-Node -Xml $xml -Candidates @('QA RevenueCat Action error')) {
    throw 'Controle nativo de QA do RevenueCat reportou erro.'
  }

  if (Find-Node -Xml $xml -Candidates @('QA RevenueCat Status configured=true isPro=true')) {
    return 'pro'
  }

  if (Find-Node -Xml $xml -Candidates @('QA RevenueCat Status configured=true isPro=false')) {
    return 'free'
  }

  return ''
}

function Wait-RevenueCatQaState {
  param(
    [string]$Adb,
    [int]$Seconds = 35,
    [string]$Name = 'qa-state'
  )

  $deadline = (Get-Date).AddSeconds($Seconds)
  $n = 0

  do {
    Start-Sleep 2
    $state = Get-RevenueCatQaState -Adb $Adb -Name "$Name-$n"

    if ($state) { return $state }
    $n++
  } until ((Get-Date) -gt $deadline)

  return ''
}

function Test-RevenueCat {
  param([string]$Adb)

  $package = 'com.engenutri.wheresthemoney'
  $state = Wait-RevenueCatQaState -Adb $Adb -Seconds 35 -Name 'qa-status-before'

  if (-not $state) {
    throw 'Status nativo de QA do RevenueCat nao ficou disponivel.'
  }

  if ($state -eq 'free') {
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
    $afterPurchase = Wait-RevenueCatQaState -Adb $Adb -Seconds 45 -Name 'qa-status-after-purchase'

    if ($afterPurchase -ne 'pro') {
      throw 'RevenueCat nao ativou Pro apos TEST VALID PURCHASE.'
    }
  }

  Invoke-Native -Exe $Adb -Arguments @('shell','am','force-stop',$package) | Out-Null
  Invoke-Native -Exe $Adb -Arguments @(
    'shell','monkey','-p',$package,'-c','android.intent.category.LAUNCHER','1'
  ) | Out-Null

  Start-Sleep 10
  Assert-AppLoaded -Adb $Adb

  $persisted = Wait-RevenueCatQaState -Adb $Adb -Seconds 35 -Name 'qa-status-persist'
  if ($persisted -ne 'pro') {
    throw 'RevenueCat nao manteve Pro apos fechar e reabrir o app.'
  }

  Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-pro.png')

  if (-not (Find-And-Tap -Adb $Adb -Candidates @('QA RevenueCat Restore') -Name 'qa-restore')) {
    throw 'Controle nativo QA RevenueCat Restore nao encontrado.'
  }

  if (-not (Wait-Text -Adb $Adb -Candidates @('QA RevenueCat Action restore-complete') -Seconds 35 -Name 'qa-restore-complete')) {
    throw 'Restore Purchases nao concluiu pelo controle nativo QA.'
  }

  $restored = Wait-RevenueCatQaState -Adb $Adb -Seconds 20 -Name 'qa-status-after-restore'
  if ($restored -ne 'pro') {
    throw 'Restore Purchases concluiu, mas o entitlement Pro nao permaneceu ativo.'
  }
}

try {
  Set-Content -Path $logPath -Value "Hackathon Android QA v11 - $(Get-Date -Format o)" -Encoding utf8
  Add-Content -Path $logPath -Value "Short build workspace: $repo" -Encoding utf8
  Add-Content -Path $logPath -Value "Metro workspace: $metroRepo" -Encoding utf8

  $hasMutex = $mutex.WaitOne([TimeSpan]::FromMinutes(20))
  if (-not $hasMutex) {
    throw 'Timeout aguardando exclusividade do Android QA.'
  }

  Invoke-Flow 'trusted-host-and-secrets' {
    Copy-TrustedSecrets
  }

  Invoke-Flow 'mobile-dependencies' {
    Invoke-Native -Exe 'npm.cmd' -Arguments @('ci','--no-audit','--no-fund') -WorkingDirectory (Join-Path $repo 'apps\mobile') | Out-Null
  }

  $tools = Get-Tools
  $script:adbPath = $tools.adb

  Invoke-Flow 'android-emulator' {
    Ensure-Emulator -Adb $tools.adb -Emulator $tools.emulator
  }

  Invoke-Flow 'metro' {
    Start-Metro -Adb $tools.adb
  }

  Invoke-Flow 'android-build-install' {
    Invoke-Native -Exe 'npx.cmd' -Arguments @('expo','run:android','--no-bundler') -WorkingDirectory (Join-Path $repo 'apps\mobile') | Out-Null
    Start-Sleep 35
  }

  Invoke-Flow 'android-smoke' {
    Assert-AppLoaded -Adb $tools.adb
    Capture-Screen -Path (Join-Path $artifactDir 'android-home.png')
  }

  Invoke-Flow 'deployed-integrations' {
    $status = Invoke-RestMethod 'https://hackathon.nutricionistaalmeidavh.workers.dev/api/integrations/status' -TimeoutSec 30
    $status | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $artifactDir 'integrations-status.json') -Encoding utf8

    if (-not $status.openFinance.configured) {
      throw 'Pluggy/Open Finance nao esta configurado no Worker publicado.'
    }

    if (-not $status.ai.configured) {
      throw 'Gemini nao esta configurado no Worker publicado.'
    }
  }

  Invoke-Flow 'revenuecat-e2e' {
    Test-RevenueCat -Adb $tools.adb
  }

  Invoke-Flow 'evidence' {
    $logcat = Join-Path $artifactDir 'logcat.txt'
    $oldPreference = $ErrorActionPreference

    try {
      $ErrorActionPreference = 'Continue'
      @(& $tools.adb logcat -d 2>&1) | Set-Content $logcat -Encoding utf8
    } finally {
      $ErrorActionPreference = $oldPreference
    }

    Get-ChildItem $artifactDir -File | ForEach-Object {
      Copy-Item $_.FullName (Join-Path $persistDir $_.Name) -Force -ErrorAction SilentlyContinue
    }
  }

  Save-Summary
  Copy-Item $qaPath (Join-Path $persistDir 'qa-summary.json') -Force -ErrorAction SilentlyContinue
  Write-Host "`nHackathon Android QA: PASS" -ForegroundColor Green
}
finally {
  try {
    if ($script:adbPath) {
      $oldPreference = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        @(& $script:adbPath logcat -d 2>&1) | Set-Content (Join-Path $artifactDir 'logcat-final.txt') -Encoding utf8
      } finally {
        $ErrorActionPreference = $oldPreference
      }
    }
  } catch {}

  try {
    if ($metroProcess -and -not $metroProcess.HasExited) {
      Stop-Process -Id $metroProcess.Id -Force -ErrorAction SilentlyContinue
    }
  } catch {}

  if (-not (Test-Path $qaPath)) {
    Save-Summary
  }

  try {
    Get-ChildItem $artifactDir -File | ForEach-Object {
      Copy-Item $_.FullName (Join-Path $persistDir $_.Name) -Force -ErrorAction SilentlyContinue
    }
  } catch {}

  if ($hasMutex) {
    try { $mutex.ReleaseMutex() } catch {}
  }

  $mutex.Dispose()
}
