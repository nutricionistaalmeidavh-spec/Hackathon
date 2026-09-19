param(
  [string]$AdbPath = 'C:\Users\Marcio\AppData\Local\Android\Sdk\platform-tools\adb.exe',
  [string]$LogPath = ''
)

$ErrorActionPreference = 'Continue'

function Write-BootstrapLog {
  param([string]$Message)
  $line = "$(Get-Date -Format o) $Message"
  Write-Host $line
  if ($LogPath) {
    $dir = Split-Path -Parent $LogPath
    if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Add-Content -Path $LogPath -Value $line -Encoding utf8
  }
}

function Test-MetroReady {
  try {
    $response = Invoke-WebRequest 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 2
    $content = [string]$response.Content
    return ($response.StatusCode -eq 200 -and $content.Trim() -eq 'packager-status:running')
  } catch {
    return $false
  }
}

function Ensure-AdbReverse {
  & $AdbPath reverse tcp:8081 tcp:8081 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-BootstrapLog 'adb reverse tcp:8081 falhou; sera tentado novamente.'
    return $false
  }

  $reverseList = (& $AdbPath reverse --list 2>$null) -join "`n"
  if ($reverseList -match 'tcp:8081\s+tcp:8081') {
    return $true
  }

  Write-BootstrapLog "adb reverse executou, mas o mapeamento 8081 ainda nao apareceu: $reverseList"
  return $false
}

function Open-DevClient {
  param([string]$MetroUrl)

  $encodedMetroUrl = [System.Uri]::EscapeDataString($MetroUrl)
  $deepLink = "exp+wheresthemoney://expo-development-client/?url=$encodedMetroUrl"
  Write-BootstrapLog "Abrindo Expo Development Build via deep link para $MetroUrl."
  & $AdbPath shell am start -a android.intent.action.VIEW -d $deepLink 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Get-UiXml {
  param([string]$Remote)

  & $AdbPath shell uiautomator dump $Remote 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { return '' }
  return ((& $AdbPath shell cat $Remote 2>$null) -join "`n")
}

if (-not (Test-Path $AdbPath)) {
  Write-BootstrapLog "ADB ausente: $AdbPath"
  exit 2
}

$deadline = (Get-Date).AddMinutes(15)
$remote = '/sdcard/artisys-devclient-bootstrap.xml'
$lastOpen = [datetime]::MinValue
$lastReverse = [datetime]::MinValue
$fallbackTried = $false

Write-BootstrapLog 'Aguardando Metro, APK e Expo Development Build; bootstrap sem intervencao manual habilitado.'

& $AdbPath wait-for-device 2>$null | Out-Null

while ((Get-Date) -lt $deadline) {
  $now = Get-Date

  if (($now - $lastReverse).TotalSeconds -ge 10) {
    if (Ensure-AdbReverse) {
      Write-BootstrapLog 'ADB reverse confirmado: tcp:8081 -> tcp:8081.'
    }
    $lastReverse = $now
  }

  $xmlText = Get-UiXml -Remote $remote

  if ($xmlText -match 'text="Hoje"|content-desc="Hoje"') {
    Write-BootstrapLog 'App carregado; navegacao Hoje detectada.'
    exit 0
  }

  $metroReady = Test-MetroReady
  $packagePath = (& $AdbPath shell pm path com.engenutri.wheresthemoney 2>$null) -join ''
  $appInstalled = ($packagePath -match '^package:')

  if ($metroReady -and $appInstalled -and (($now - $lastOpen).TotalSeconds -ge 12)) {
    Ensure-AdbReverse | Out-Null
    Open-DevClient -MetroUrl 'http://127.0.0.1:8081' | Out-Null
    $lastOpen = $now
    Start-Sleep 6

    $xmlText = Get-UiXml -Remote $remote
    if ($xmlText -match 'text="Hoje"|content-desc="Hoje"') {
      Write-BootstrapLog 'App carregado apos deep link 127.0.0.1:8081.'
      exit 0
    }
  }

  if ($xmlText -match 'DEVELOPMENT SERVERS') {
    if ($xmlText -match 'text="http://127\.0\.0\.1:8081"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
      $x = [int](([int]$matches[1] + [int]$matches[3]) / 2)
      $y = [int](([int]$matches[2] + [int]$matches[4]) / 2)
      Write-BootstrapLog "Launcher detectado; selecionando 127.0.0.1:8081 em $x,$y."
      Ensure-AdbReverse | Out-Null
      & $AdbPath shell input tap $x $y 2>$null | Out-Null
      Start-Sleep 8
      continue
    }

    if ($metroReady -and -not $fallbackTried) {
      Write-BootstrapLog 'Launcher detectado sem servidor selecionavel; tentando fallback AVD 10.0.2.2:8081.'
      Open-DevClient -MetroUrl 'http://10.0.2.2:8081' | Out-Null
      $fallbackTried = $true
      Start-Sleep 8
      continue
    }
  }

  if ($xmlText -match 'There was a problem loading the project\.') {
    if ($xmlText -match 'text="Reload"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
      $x = [int](([int]$matches[1] + [int]$matches[3]) / 2)
      $y = [int](([int]$matches[2] + [int]$matches[4]) / 2)
      Write-BootstrapLog 'Tela de erro do Development Build detectada; refazendo reverse e acionando Reload.'
      Ensure-AdbReverse | Out-Null
      & $AdbPath shell input tap $x $y 2>$null | Out-Null
      Start-Sleep 8
      continue
    }
  }

  Start-Sleep 3
}

Write-BootstrapLog 'Timeout de 15 minutos: app nao chegou a tela Hoje. Verifique devclient-bootstrap.log e artefatos de UI.'
exit 1
