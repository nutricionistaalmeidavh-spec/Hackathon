param()

$ErrorActionPreference = 'Stop'

# O Expo anuncia o Metro em http://localhost:8081. No host Windows do
# Woodpecker, a verificacao TCP usada pelo v9 produziu falsos negativos mesmo
# com o endpoint respondendo HTTP 200. Mantemos a interface esperada pelo v9,
# mas a readiness passa a usar o endpoint oficial /status.
function Test-NetConnection {
  [CmdletBinding()]
  param(
    [Parameter(Position = 0)]
    [string]$ComputerName,
    [int]$Port
  )

  if ($Port -eq 8081 -and $ComputerName -eq '127.0.0.1') {
    $ready = $false
    try {
      $response = Invoke-WebRequest 'http://localhost:8081/status' -UseBasicParsing -TimeoutSec 3
      $content = if ($response.Content -is [byte[]]) {
        [Text.Encoding]::UTF8.GetString($response.Content)
      } else {
        [string]$response.Content
      }
      $ready = ($response.StatusCode -eq 200 -and $content.Trim() -eq 'packager-status:running')
    } catch {
      $ready = $false
    }

    return [pscustomobject]@{
      TcpTestSucceeded = $ready
      ComputerName = 'localhost'
      RemotePort = $Port
    }
  }

  throw "Test-NetConnection inesperado no Android QA: $ComputerName`:$Port"
}

# Evita o panic do instalador de React Native DevTools observado no Woodpecker.
# O diretorio fica fora do repositorio e nao contem segredos.
if (-not $env:DOTSLASH_CACHE) {
  $env:DOTSLASH_CACHE = Join-Path $env:TEMP 'artisys-dotslash-cache'
}
New-Item -ItemType Directory -Force -Path $env:DOTSLASH_CACHE | Out-Null

$runner = Join-Path $PSScriptRoot 'hackathon-android-v9.ps1'
if (-not (Test-Path $runner)) {
  throw "Runner Android v9 nao encontrado: $runner"
}

Write-Host 'Android QA v10: Metro validado por HTTP /status; DOTSLASH_CACHE configurado.' -ForegroundColor Cyan
. $runner
