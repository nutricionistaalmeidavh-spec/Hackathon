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
  } | ConvertTo-Json -Depth 12 | Set-Content -Path $qaPath -Encoding utf8
}

function Add-Result {
  param([string]$Name,[string]$Status,[string]$Error='',[string]$Command='',[Nullable[int]]$ExitCode=$null,[string]$Screenshot='')
  $evidence=@{ runSummary=$qaPath; outputDir=$persistDir }
  if($Screenshot){$evidence.screenshot=$Screenshot}
  $script:flows += [pscustomobject]@{
    flow=$Name; status=$Status; error=$Error
    failedStep=if($Status -eq 'FAIL'){@{name=$Name;action=$Command;error=$Error;exitCode=$ExitCode}}else{$null}
    evidence=$evidence
  }
}

function Write-LoggedOutput { param($Output); foreach($line in @($Output)){ $text=[string]$line; Write-Host $text; Add-Content -Path $logPath -Value $text -Encoding utf8 } }

function Invoke-Native {
  param([string]$Exe,[string[]]$Arguments=@(),[string]$WorkingDirectory='')
  $commandText="$Exe $($Arguments -join ' ')".Trim()
  Add-Content -Path $logPath -Value "`n> $commandText" -Encoding utf8
  $oldPreference=$ErrorActionPreference; $output=@(); $exitCode=$null
  try {
    if($WorkingDirectory){Push-Location $WorkingDirectory}
    $ErrorActionPreference='Continue'
    $output=@(& $Exe @Arguments 2>&1)
    $exitCode=$LASTEXITCODE
  } catch { $output += $_.Exception.Message; if($null -eq $exitCode){$exitCode=1} }
  finally { $ErrorActionPreference=$oldPreference; if($WorkingDirectory){Pop-Location} }
  Write-LoggedOutput $output
  Add-Content -Path $logPath -Value "exit=$exitCode" -Encoding utf8
  if($exitCode -ne 0){
    $tail=(@($output)|Select-Object -Last 35|ForEach-Object{[string]$_}) -join "`n"
    throw "$commandText falhou (exit $exitCode): $tail"
  }
  return ,$output
}

function Capture-Screen {
  param([string]$Path)
  if(-not $script:adbPath){return}
  $remote='/sdcard/qa-screen.png'
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
    $shot=Join-Path $artifactDir 'failure.png'
    try{Capture-Screen -Path $shot}catch{}
    $persistShot=''
    if(Test-Path $shot){$persistShot=Join-Path $persistDir 'failure.png'; try{Copy-Item $shot $persistShot -Force}catch{}}
    $message=$_.Exception.Message
    Add-Content -Path $logPath -Value "FAIL: $message" -Encoding utf8
    Add-Result -Name $Name -Status 'FAIL' -Error $message -Command $Name -ExitCode 1 -Screenshot $persistShot
    Save-Summary
    throw
  }
}

function Copy-TrustedSecrets {
  $mobileSource=Join-Path $secretSource 'apps\mobile\.env'
  $workerSource=Join-Path $secretSource '.dev.vars'
  $mobileTarget=Join-Path $repo 'apps\mobile\.env'
  $workerTarget=Join-Path $repo '.dev.vars'
  if(-not(Test-Path $mobileSource)){throw "Mobile .env nao encontrado no host confiavel: $mobileSource"}
  Copy-Item $mobileSource $mobileTarget -Force
  if(Test-Path $workerSource){Copy-Item $workerSource $workerTarget -Force}
  $lines=Get-Content $mobileTarget
  if(-not($lines -match '^EXPO_PUBLIC_REVENUECAT_API_KEY=.+')){throw 'EXPO_PUBLIC_REVENUECAT_API_KEY ausente.'}
  if(-not($lines -match '^EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro$')){throw 'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID precisa ser pro.'}
  Write-Host 'Secrets locais carregados sem exibir valores.'
}

function Get-Tools {
  if(-not $env:ANDROID_HOME){$env:ANDROID_HOME='C:\Users\Marcio\AppData\Local\Android\Sdk'}
  $adb=Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
  $emu=Join-Path $env:ANDROID_HOME 'emulator\emulator.exe'
  if(-not(Test-Path $adb)){throw "adb nao encontrado: $adb"}
  if(-not(Test-Path $emu)){throw "emulator nao encontrado: $emu"}
  return @{adb=$adb;emulator=$emu}
}

function Get-AdbDevices {
  param([string]$Adb)
  $oldPreference=$ErrorActionPreference
  try{$ErrorActionPreference='Continue'; return @(& $Adb devices 2>&1)}finally{$ErrorActionPreference=$oldPreference}
}

function Ensure-Emulator {
  param([string]$Adb,[string]$Emulator)
  Invoke-Native -Exe $Adb -Arguments @('start-server') | Out-Null
  $devices=Get-AdbDevices -Adb $Adb
  if(-not($devices -match 'emulator-\d+\s+device')){
    $avds=@(& $Emulator -list-avds)
    $avd=$avds|Where-Object{$_ -eq 'Pixel_9'}|Select-Object -First 1
    if(-not $avd){$avd=$avds|Select-Object -First 1}
    if(-not $avd){throw 'Nenhum AVD Android encontrado.'}
    Write-Host "Iniciando AVD $avd em modo headless."
    Start-Process $Emulator -ArgumentList @('-avd',$avd,'-no-window','-no-audio','-no-boot-anim','-no-snapshot-save','-gpu','swiftshader_indirect') | Out-Null
  }
  $deadline=(Get-Date).AddMinutes(5)
  do{Start-Sleep 3;$devices=Get-AdbDevices -Adb $Adb}until(($devices -match 'emulator-\d+\s+device') -or (Get-Date)-gt $deadline)
  if(-not($devices -match 'emulator-\d+\s+device')){throw 'Emulador nao apareceu no adb.'}
  $boot=''
  do{
    Start-Sleep 3
    $oldPreference=$ErrorActionPreference
    try{$ErrorActionPreference='Continue';$boot=((& $Adb shell getprop sys.boot_completed 2>$null)-join '').Trim()}finally{$ErrorActionPreference=$oldPreference}
  }until($boot -eq '1' -or (Get-Date)-gt $deadline)
  if($boot -ne '1'){throw 'Android nao concluiu o boot.'}
  Write-LoggedOutput $devices
}

function Start-Metro {
  param([string]$Adb)
  Invoke-Native -Exe $Adb -Arguments @('reverse','tcp:8081','tcp:8081') | Out-Null
  $metroLog=Join-Path $artifactDir 'metro.log'
  $mobile=Join-Path $repo 'apps\mobile'
  $cmd="Set-Location '$mobile'; npx.cmd expo start --dev-client --localhost --port 8081 *> '$metroLog'"
  $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
  $script:metroProcess=Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList '-NoProfile','-EncodedCommand',$encoded
  $deadline=(Get-Date).AddSeconds(120);$ready=$false
  do{Start-Sleep 2;$ready=(Test-NetConnection 127.0.0.1 -Port 8081 -WarningAction SilentlyContinue).TcpTestSucceeded}until($ready -or (Get-Date)-gt $deadline)
  if(-not $ready){$tail=if(Test-Path $metroLog){(Get-Content $metroLog -Tail 60)-join "`n"}else{'metro.log ausente'};throw "Metro nao abriu 8081: $tail"}
}

function Dump-Ui {
  param([string]$Adb,[string]$Name)
  $remote='/sdcard/window.xml';$local=Join-Path $artifactDir "$Name.xml";$ok=$false
  for($i=0;$i -lt 3;$i++){
    $oldPreference=$ErrorActionPreference
    try{$ErrorActionPreference='Continue';& $Adb shell uiautomator dump $remote|Out-Null;if($LASTEXITCODE -eq 0){$ok=$true;break}}finally{$ErrorActionPreference=$oldPreference}
    Start-Sleep 2
  }
  if(-not $ok){throw 'uiautomator dump falhou.'}
  Invoke-Native -Exe $Adb -Arguments @('pull',$remote,$local) | Out-Null
  Copy-Item $local (Join-Path $persistDir "$Name.xml") -Force -ErrorAction SilentlyContinue
  return [xml](Get-Content $local -Raw)
}

function Find-Node {
  param([xml]$Xml,[string[]]$Candidates)
  foreach($candidate in $Candidates){
    $found=$Xml.SelectNodes('//node')|Where-Object{$text=$_.GetAttribute('text');$desc=$_.GetAttribute('content-desc');$text -eq $candidate -or $desc -eq $candidate -or $text -like "*$candidate*" -or $desc -like "*$candidate*"}|Select-Object -First 1
    if($found){return $found}
  }
  return $null
}

function Tap-Node {
  param([string]$Adb,$Node)
  $bounds=$Node.GetAttribute('bounds')
  if($bounds -notmatch '\[(\d+),(\d+)\]\[(\d+),(\d+)\]'){throw "Bounds invalidos: $bounds"}
  $x=[int](([int]$matches[1]+[int]$matches[3])/2);$y=[int](([int]$matches[2]+[int]$matches[4])/2)
  Invoke-Native -Exe $Adb -Arguments @('shell','input','tap',"$x","$y") | Out-Null
}

function Find-And-Tap {
  param([string]$Adb,[string[]]$Candidates,[string]$Name,[int]$Scrolls=0)
  for($i=0;$i -le $Scrolls;$i++){
    $xml=Dump-Ui -Adb $Adb -Name "$Name-$i";$node=Find-Node -Xml $xml -Candidates $Candidates
    if($node){Tap-Node -Adb $Adb -Node $node;return $true}
    if($i -lt $Scrolls){Invoke-Native -Exe $Adb -Arguments @('shell','input','swipe','540','1750','540','650','350')|Out-Null;Start-Sleep 1}
  }
  return $false
}

function Wait-Text {
  param([string]$Adb,[string[]]$Candidates,[int]$Seconds=20,[string]$Name='wait')
  $deadline=(Get-Date).AddSeconds($Seconds);$n=0
  do{Start-Sleep 2;$xml=Dump-Ui -Adb $Adb -Name "$Name-$n";if(Find-Node -Xml $xml -Candidates $Candidates){return $true};$n++}until((Get-Date)-gt $deadline)
  return $false
}

function Assert-AppLoaded {
  param([string]$Adb)
  $xml=Dump-Ui -Adb $Adb -Name 'app-loaded'
  if(Find-Node -Xml $xml -Candidates @('There was a problem loading the project.')){$reload=Find-Node -Xml $xml -Candidates @('Reload');if($reload){Tap-Node -Adb $Adb -Node $reload;Start-Sleep 10;$xml=Dump-Ui -Adb $Adb -Name 'app-reloaded'}}
  if(Find-Node -Xml $xml -Candidates @('There was a problem loading the project.')){throw 'Development build ainda sem conexao com Metro.'}
  foreach($label in @('Hoje','Inbox','Radar','Planejar','Mais')){if(-not(Find-Node -Xml $xml -Candidates @($label))){throw "Navegacao '$label' nao encontrada no APK."}}
}

function Test-RevenueCat {
  param([string]$Adb)
  if(-not(Find-And-Tap -Adb $Adb -Candidates @('Mais') -Name 'nav-more')){throw 'Aba Mais nao encontrada.'}
  Start-Sleep 4
  $alreadyPro=Wait-Text -Adb $Adb -Candidates @('Plano Pro ativo','Gerenciar assinatura real') -Seconds 3 -Name 'pro-before'
  if(-not $alreadyPro){
    if(-not(Find-And-Tap -Adb $Adb -Candidates @('Ver assinatura Pro','Assinar Pro','Gerenciar assinatura') -Name 'open-plan' -Scrolls 5)){throw 'Acao de assinatura nao encontrada em Mais.'}
    Start-Sleep 5;Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-paywall.png')
    $valid=Find-And-Tap -Adb $Adb -Candidates @('TEST VALID PURCHASE') -Name 'valid-direct' -Scrolls 2
    if(-not $valid){$purchase=Find-And-Tap -Adb $Adb -Candidates @('Test Store Purchase','Subscribe','Continue','Get Pro','Upgrade','Assinar') -Name 'purchase' -Scrolls 3;if(-not $purchase){throw 'Acao de compra do paywall nao encontrada.'};Start-Sleep 3;$valid=Find-And-Tap -Adb $Adb -Candidates @('TEST VALID PURCHASE') -Name 'valid-after-purchase' -Scrolls 2}
    if(-not $valid){throw 'TEST VALID PURCHASE nao apareceu.'};Start-Sleep 8
  }
  Invoke-Native -Exe $Adb -Arguments @('shell','am','force-stop','com.engenutri.wheresthemoney')|Out-Null
  Invoke-Native -Exe $Adb -Arguments @('shell','monkey','-p','com.engenutri.wheresthemoney','-c','android.intent.category.LAUNCHER','1')|Out-Null
  Start-Sleep 8;Assert-AppLoaded -Adb $Adb
  if(-not(Find-And-Tap -Adb $Adb -Candidates @('Mais') -Name 'nav-more-after')){throw 'Aba Mais nao encontrada apos reabrir.'}
  Start-Sleep 4
  if(-not(Wait-Text -Adb $Adb -Candidates @('Plano Pro ativo','Gerenciar assinatura real') -Seconds 15 -Name 'pro-after')){throw 'RevenueCat nao manteve Pro apos compra/reabertura.'}
  Capture-Screen -Path (Join-Path $artifactDir 'revenuecat-pro.png')
  if(-not(Find-And-Tap -Adb $Adb -Candidates @('Restaurar compra','Restaurar','Restore purchases') -Name 'restore' -Scrolls 4)){throw 'Acao Restaurar nao encontrada.'}
  Start-Sleep 5
  if(-not(Wait-Text -Adb $Adb -Candidates @('Plano Pro ativo','Gerenciar assinatura real') -Seconds 10 -Name 'restore-pro')){throw 'Restore Purchases nao preservou Pro.'}
}

try {
  Set-Content -Path $logPath -Value "Hackathon Android QA - $(Get-Date -Format o)" -Encoding utf8
  $hasMutex=$mutex.WaitOne([TimeSpan]::FromMinutes(20));if(-not $hasMutex){throw 'Timeout aguardando exclusividade do Android QA.'}
  Invoke-Flow 'trusted-host-and-secrets' { Copy-TrustedSecrets }
  Invoke-Flow 'mobile-dependencies' { Invoke-Native -Exe 'npm.cmd' -Arguments @('ci','--no-audit','--no-fund') -WorkingDirectory (Join-Path $repo 'apps\mobile')|Out-Null }
  $tools=Get-Tools;$script:adbPath=$tools.adb
  Invoke-Flow 'android-emulator' { Ensure-Emulator -Adb $tools.adb -Emulator $tools.emulator }
  Invoke-Flow 'metro' { Start-Metro -Adb $tools.adb }
  Invoke-Flow 'android-build-install' { Invoke-Native -Exe 'npx.cmd' -Arguments @('expo','run:android','--no-bundler') -WorkingDirectory (Join-Path $repo 'apps\mobile')|Out-Null;Start-Sleep 10 }
  Invoke-Flow 'android-smoke' { Assert-AppLoaded -Adb $tools.adb;Capture-Screen -Path (Join-Path $artifactDir 'android-home.png') }
  Invoke-Flow 'deployed-integrations' {
    $status=Invoke-RestMethod 'https://hackathon.nutricionistaalmeidavh.workers.dev/api/integrations/status' -TimeoutSec 30
    $status|ConvertTo-Json -Depth 8|Set-Content (Join-Path $artifactDir 'integrations-status.json') -Encoding utf8
    if(-not $status.openFinance.configured){throw 'Pluggy/Open Finance nao esta configurado no Worker publicado.'}
    if(-not $status.ai.configured){throw 'Gemini nao esta configurado no Worker publicado.'}
  }
  Invoke-Flow 'revenuecat-e2e' { Test-RevenueCat -Adb $tools.adb }
  Invoke-Flow 'evidence' {
    $logcat=Join-Path $artifactDir 'logcat.txt';$oldPreference=$ErrorActionPreference
    try{$ErrorActionPreference='Continue';@(& $tools.adb logcat -d 2>&1)|Set-Content $logcat -Encoding utf8}finally{$ErrorActionPreference=$oldPreference}
    Get-ChildItem $artifactDir -File|ForEach-Object{Copy-Item $_.FullName (Join-Path $persistDir $_.Name) -Force -ErrorAction SilentlyContinue}
  }
  Save-Summary;Copy-Item $qaPath (Join-Path $persistDir 'qa-summary.json') -Force -ErrorAction SilentlyContinue
  Write-Host "`nHackathon Android QA: PASS" -ForegroundColor Green
} finally {
  try{if($script:adbPath){$oldPreference=$ErrorActionPreference;try{$ErrorActionPreference='Continue';@(& $script:adbPath logcat -d 2>&1)|Set-Content (Join-Path $artifactDir 'logcat-final.txt') -Encoding utf8}finally{$ErrorActionPreference=$oldPreference}}}catch{}
  try{if($metroProcess -and -not $metroProcess.HasExited){Stop-Process -Id $metroProcess.Id -Force -ErrorAction SilentlyContinue}}catch{}
  if(-not(Test-Path $qaPath)){Save-Summary}
  try{Get-ChildItem $artifactDir -File|ForEach-Object{Copy-Item $_.FullName (Join-Path $persistDir $_.Name) -Force -ErrorAction SilentlyContinue}}catch{}
  if($hasMutex){try{$mutex.ReleaseMutex()}catch{}};$mutex.Dispose()
}
