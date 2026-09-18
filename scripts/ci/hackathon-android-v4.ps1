param()

$ErrorActionPreference = 'Stop'
$repoLong = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$drive = $null

try {
  foreach ($candidate in @('Q:', 'R:', 'S:', 'T:')) {
    if (-not (Test-Path "$candidate\")) {
      $drive = $candidate
      break
    }
  }

  if (-not $drive) {
    throw 'Nenhuma letra curta disponivel para mapear o workspace Android.'
  }

  Write-Host "Mapeando workspace Android curto: $drive -> $repoLong" -ForegroundColor Cyan
  & subst.exe $drive $repoLong
  if ($LASTEXITCODE -ne 0) {
    throw "subst falhou para $drive (exit $LASTEXITCODE)"
  }

  $shortRepo = "$drive\"
  $runner = Join-Path $shortRepo 'scripts\ci\hackathon-android-v3.ps1'
  if (-not (Test-Path $runner)) {
    throw "Runner Android nao encontrado no caminho curto: $runner"
  }

  Set-Location $shortRepo
  Write-Host "Workspace curto ativo: $shortRepo" -ForegroundColor Green
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner
  if ($LASTEXITCODE -ne 0) {
    throw "hackathon-android-v3.ps1 falhou (exit $LASTEXITCODE)"
  }
}
finally {
  try { Set-Location 'C:\' } catch {}
  if ($drive) {
    & subst.exe $drive /D 2>$null
  }
}
