param()

$ErrorActionPreference = 'Stop'
$repoLong = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runKey = if ($env:CI_COMMIT_SHA) { $env:CI_COMMIT_SHA.Substring(0, [Math]::Min(8, $env:CI_COMMIT_SHA.Length)) } else { Get-Date -Format 'HHmmss' }
$shortRootBase = 'C:\w'
$shortRepo = Join-Path $shortRootBase ("h-$runKey")
$originalArtifacts = Join-Path $repoLong 'artifacts'
$shortArtifacts = Join-Path $shortRepo 'artifacts'
$runner = Join-Path $shortRepo 'scripts\ci\hackathon-android-v3.ps1'
$exitCode = 1

function Sync-ArtifactsBack {
  if (Test-Path $shortArtifacts) {
    New-Item -ItemType Directory -Force -Path $originalArtifacts | Out-Null
    Copy-Item (Join-Path $shortArtifacts '*') $originalArtifacts -Recurse -Force -ErrorAction SilentlyContinue
  }
}

try {
  New-Item -ItemType Directory -Force -Path $shortRootBase | Out-Null
  if (Test-Path $shortRepo) {
    Remove-Item $shortRepo -Recurse -Force -ErrorAction Stop
  }
  New-Item -ItemType Directory -Force -Path $shortRepo | Out-Null

  Write-Host "Copiando workspace para caminho fisico curto: $shortRepo" -ForegroundColor Cyan
  $roboArgs = @(
    $repoLong,
    $shortRepo,
    '/E',
    '/R:2',
    '/W:1',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/NP',
    '/XD',
    '.git',
    'node_modules',
    'dist',
    'artifacts',
    '.expo',
    '.wrangler',
    'android',
    '/XF',
    '.env',
    '.dev.vars'
  )
  & robocopy.exe @roboArgs | Out-Host
  $roboExit = $LASTEXITCODE
  if ($roboExit -ge 8) {
    throw "robocopy falhou (exit $roboExit)"
  }

  if (-not (Test-Path $runner)) {
    throw "Runner Android nao encontrado no workspace curto: $runner"
  }

  $resolvedShort = (Resolve-Path $shortRepo).Path
  if ($resolvedShort.Length -gt 40) {
    throw "Workspace curto continua longo demais: $resolvedShort"
  }

  # O dev client deve acessar o Metro pelo adb reverse, sem depender do IP da LAN.
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'

  # O primeiro bundle do Metro pode levar mais de 10s no runner frio. Mantemos o
  # runner principal intacto e endurecemos somente a copia efemera desta execucao.
  $runnerText = Get-Content $runner -Raw
  $oldBuild = "Invoke-Flow 'android-build-install' { Invoke-Native -Exe 'npx.cmd' -Arguments @('expo','run:android','--no-bundler') -WorkingDirectory (Join-Path `$repo 'apps\mobile')|Out-Null;Start-Sleep 10 }"
  $newBuild = "Invoke-Flow 'android-build-install' { Invoke-Native -Exe 'npx.cmd' -Arguments @('expo','run:android','--no-bundler') -WorkingDirectory (Join-Path `$repo 'apps\mobile')|Out-Null;Start-Sleep 35 }"
  if (-not $runnerText.Contains($oldBuild)) {
    throw 'Nao foi possivel localizar o bloco android-build-install para endurecer o bootstrap.'
  }
  $runnerText = $runnerText.Replace($oldBuild, $newBuild)

  $oldSmoke = "Invoke-Flow 'android-smoke' { Assert-AppLoaded -Adb `$tools.adb;Capture-Screen -Path (Join-Path `$artifactDir 'android-home.png') }"
  $newSmoke = @"
Invoke-Flow 'android-smoke' {
    `$deadline=(Get-Date).AddSeconds(75)
    `$loaded=`$false
    `$last=''
    do {
      try {
        Assert-AppLoaded -Adb `$tools.adb
        `$loaded=`$true
        break
      } catch {
        `$last=`$_.Exception.Message
        Start-Sleep 5
      }
    } until((Get-Date)-gt `$deadline)
    if(-not `$loaded){
      try {
        `$diag=Dump-Ui -Adb `$tools.adb -Name 'app-smoke-final'
        `$visible=@(`$diag.SelectNodes('//node') | ForEach-Object { `$t=`$_.GetAttribute('text'); `$d=`$_.GetAttribute('content-desc'); if(`$t){`$t}elseif(`$d){`$d} } | Where-Object { `$_ } | Select-Object -Unique) -join ' | '
        throw "`$last UI visivel: `$visible"
      } catch {
        if(`$_.Exception.Message -like '*UI visivel:*'){ throw }
        throw `$last
      }
    }
    Capture-Screen -Path (Join-Path `$artifactDir 'android-home.png')
  }
"@
  if (-not $runnerText.Contains($oldSmoke)) {
    throw 'Nao foi possivel localizar o bloco android-smoke para adicionar retry.'
  }
  $runnerText = $runnerText.Replace($oldSmoke, $newSmoke.Trim())
  Set-Content -Path $runner -Value $runnerText -Encoding utf8

  Write-Host "Workspace Android fisico: $resolvedShort" -ForegroundColor Green
  Write-Host 'Bootstrap Android: Metro via localhost + espera de ate 75s para a UI nativa.' -ForegroundColor Green
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner
  $exitCode = $LASTEXITCODE
  Sync-ArtifactsBack

  if ($exitCode -ne 0) {
    throw "hackathon-android-v3.ps1 falhou (exit $exitCode)"
  }
}
finally {
  try { Sync-ArtifactsBack } catch {}
  try { Set-Location 'C:\' } catch {}
  try {
    if (Test-Path $shortRepo) {
      Remove-Item $shortRepo -Recurse -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}
