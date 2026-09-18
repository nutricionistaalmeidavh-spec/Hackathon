param()

$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repo

$artifactDir = Join-Path $repo 'artifacts'
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$logPath = Join-Path $artifactDir 'woodpecker-hackathon-static.log'
$qaPath = Join-Path $artifactDir 'qa-summary.json'
$flows = @()

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
  param([string]$Name,[string]$Status,[string]$Error = '',[string]$Command = '',[Nullable[int]]$ExitCode = $null)
  $script:flows += [pscustomobject]@{
    flow = $Name; status = $Status; error = $Error
    failedStep = if ($Status -eq 'FAIL') { @{ name = $Name; action = $Command; error = $Error; exitCode = $ExitCode } } else { $null }
    evidence = @{ runSummary = $qaPath; outputDir = $artifactDir }
  }
}

function Write-LoggedOutput { param($Output); foreach ($line in @($Output)) { $text=[string]$line; Write-Host $text; Add-Content -Path $logPath -Value $text -Encoding utf8 } }

function Invoke-External {
  param([string]$Name,[string]$Exe,[string[]]$Arguments=@(),[string]$WorkingDirectory='')
  $commandText="$Exe $($Arguments -join ' ')".Trim()
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  Add-Content -Path $logPath -Value "`n=== $Name ===`n$commandText" -Encoding utf8
  $oldPreference=$ErrorActionPreference; $exitCode=$null; $output=@()
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
    $tail=(@($output)|Select-Object -Last 30|ForEach-Object{[string]$_}) -join "`n"
    $message="$Name falhou (exit $exitCode): $tail"
    Add-Result -Name $Name -Status 'FAIL' -Error $message -Command $commandText -ExitCode $exitCode
    Save-Summary
    throw $message
  }
  Add-Result -Name $Name -Status 'PASS' -Command $commandText -ExitCode 0
  Save-Summary
}

try {
  Set-Content -Path $logPath -Value "Hackathon static QA - $(Get-Date -Format o)" -Encoding utf8
  Invoke-External -Name 'node-version' -Exe 'node.exe' -Arguments @('--version')
  Invoke-External -Name 'npm-version' -Exe 'npm.cmd' -Arguments @('--version')
  Invoke-External -Name 'git-version' -Exe 'git.exe' -Arguments @('--version')
  Invoke-External -Name 'npm-ci-root' -Exe 'npm.cmd' -Arguments @('ci','--no-audit','--no-fund') -WorkingDirectory $repo
  Invoke-External -Name 'npm-ci-mobile' -Exe 'npm.cmd' -Arguments @('ci','--no-audit','--no-fund') -WorkingDirectory (Join-Path $repo 'apps\mobile')
  Invoke-External -Name 'mobile-tests' -Exe 'npm.cmd' -Arguments @('test') -WorkingDirectory (Join-Path $repo 'apps\mobile')
  Invoke-External -Name 'mobile-typecheck' -Exe 'npm.cmd' -Arguments @('run','typecheck') -WorkingDirectory (Join-Path $repo 'apps\mobile')
  Invoke-External -Name 'web-worker-tests' -Exe 'npm.cmd' -Arguments @('test') -WorkingDirectory $repo
  Invoke-External -Name 'production-build' -Exe 'npm.cmd' -Arguments @('run','build') -WorkingDirectory $repo
  Write-Host "`nHackathon static QA: PASS" -ForegroundColor Green
} finally { if(-not(Test-Path $qaPath)){Save-Summary} }
