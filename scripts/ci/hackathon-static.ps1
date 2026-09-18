param()

$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repo

$artifactDir = Join-Path $repo 'artifacts'
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$logPath = Join-Path $artifactDir 'woodpecker-hackathon-static.log'
$qaPath = Join-Path $artifactDir 'qa-summary.json'
$flows = @()

function Add-FlowResult {
  param([string]$Name, [string]$Status, [string]$Error = '')
  $script:flows += [pscustomobject]@{
    flow = $Name
    status = $Status
    error = $Error
    evidence = @{ runSummary = $qaPath }
  }
}

function Save-Summary {
  $passed = @($flows | Where-Object status -eq 'PASS').Count
  $failed = @($flows | Where-Object status -eq 'FAIL').Count
  [pscustomobject]@{
    status = if ($failed) { 'FAIL' } else { 'PASS' }
    counts = @{ flowsPassed = $passed; flowsFailed = $failed }
    flows = $flows
  } | ConvertTo-Json -Depth 8 | Set-Content -Path $qaPath -Encoding utf8
}

function Invoke-Flow {
  param([string]$Name, [scriptblock]$Action)
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  try {
    & $Action *>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "$Name terminou com exit code $LASTEXITCODE" }
    Add-FlowResult -Name $Name -Status 'PASS'
  } catch {
    Add-FlowResult -Name $Name -Status 'FAIL' -Error $_.Exception.Message
    Save-Summary
    throw
  }
}

try {
  Invoke-Flow 'environment' {
    node --version
    npm --version
    git --version
  }

  Invoke-Flow 'npm-ci-root' {
    npm ci --no-audit --no-fund
  }

  Invoke-Flow 'npm-ci-mobile' {
    Push-Location 'apps/mobile'
    try { npm ci --no-audit --no-fund } finally { Pop-Location }
  }

  Invoke-Flow 'mobile-tests' {
    Push-Location 'apps/mobile'
    try { npm test } finally { Pop-Location }
  }

  Invoke-Flow 'mobile-typecheck' {
    Push-Location 'apps/mobile'
    try { npm run typecheck } finally { Pop-Location }
  }

  Invoke-Flow 'web-worker-tests' {
    npm test
  }

  Invoke-Flow 'production-build' {
    npm run build
  }

  Save-Summary
  Write-Host "`nHackathon static QA: PASS" -ForegroundColor Green
} finally {
  if (-not (Test-Path $qaPath)) { Save-Summary }
}
