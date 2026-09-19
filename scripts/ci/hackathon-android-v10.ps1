param()

$ErrorActionPreference = 'Stop'

# Compatibilidade do runner Windows: o Expo pode anunciar localhost:8081 e
# abrir o listener em IPv6 (::1). O v9 verificava apenas 127.0.0.1, gerando
# falso negativo mesmo com o Metro pronto. Este wrapper nao altera o v9 em
# runtime; apenas fornece uma verificacao local de porta independente da
# familia IP durante esta execucao.
function Test-NetConnection {
  [CmdletBinding()]
  param(
    [Parameter(Position = 0)]
    [string]$ComputerName,
    [int]$Port
  )

  if ($Port -eq 8081 -and $ComputerName -eq '127.0.0.1') {
    $listener = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1

    return [pscustomobject]@{
      TcpTestSucceeded = [bool]$listener
      ComputerName = $ComputerName
      RemotePort = $Port
    }
  }

  throw "Test-NetConnection inesperado no Android QA: $ComputerName`:$Port"
}

# Evita o panic do instalador de React Native DevTools observado no Woodpecker.
# O diretório fica fora do repositório e não contém segredos.
if (-not $env:DOTSLASH_CACHE) {
  $env:DOTSLASH_CACHE = Join-Path $env:TEMP 'artisys-dotslash-cache'
}
New-Item -ItemType Directory -Force -Path $env:DOTSLASH_CACHE | Out-Null

$runner = Join-Path $PSScriptRoot 'hackathon-android-v9.ps1'
if (-not (Test-Path $runner)) {
  throw "Runner Android v9 nao encontrado: $runner"
}

Write-Host 'Android QA v10: readiness do Metro independente de IPv4/IPv6; DOTSLASH_CACHE configurado.' -ForegroundColor Cyan
. $runner
