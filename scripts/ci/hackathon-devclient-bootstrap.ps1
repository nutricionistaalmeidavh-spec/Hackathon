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

if (-not (Test-Path $AdbPath)) {
  Write-BootstrapLog "ADB ausente: $AdbPath"
  exit 2
}

$deadline = (Get-Date).AddMinutes(6)
$remote = '/sdcard/artisys-devclient-bootstrap.xml'

Write-BootstrapLog 'Aguardando Expo Development Build para selecionar http://127.0.0.1:8081.'

while ((Get-Date) -lt $deadline) {
  & $AdbPath shell uiautomator dump $remote 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $xmlText = (& $AdbPath shell cat $remote 2>$null) -join "`n"

    if ($xmlText -match 'text="Hoje"|content-desc="Hoje"') {
      Write-BootstrapLog 'App ja carregado; bootstrap manual do dev client nao foi necessario.'
      exit 0
    }

    if ($xmlText -match 'text="http://127\.0\.0\.1:8081"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
      $x = [int](([int]$matches[1] + [int]$matches[3]) / 2)
      $y = [int](([int]$matches[2] + [int]$matches[4]) / 2)
      Write-BootstrapLog "Development Build detectado; tocando servidor local em $x,$y."
      & $AdbPath shell input tap $x $y 2>$null | Out-Null
      Start-Sleep 8
      Write-BootstrapLog 'Servidor local selecionado; controle devolvido ao QA principal.'
      exit 0
    }
  }

  Start-Sleep 3
}

Write-BootstrapLog 'Timeout: Development Build nao exibiu o servidor local durante a janela de bootstrap.'
exit 1
