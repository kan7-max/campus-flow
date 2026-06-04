[CmdletBinding()]
param(
  [ValidateSet("quick", "full")]
  [string]$Mode = "quick"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath ".").Path
$reportDir = Join-Path $root "docs/release-reports"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportPath = Join-Path $reportDir "local-release-gate-$timestamp.md"
$qaDistDirName = ".next-qa-$timestamp"

$env:NEXT_TELEMETRY_DISABLED = "1"
$env:TASKFLOW_DEMO_MODE = "1"
$env:TASKFLOW_QA_DIST_DIR = $qaDistDirName

$quickSteps = @(
  @{ Name = "check"; Command = "npm run check" },
  @{ Name = "qa:preprod"; Command = "npm run qa:preprod" }
)

$fullSteps = @(
  @{ Name = "check"; Command = "npm run check" },
  @{ Name = "qa:preprod"; Command = "npm run qa:preprod" },
  @{ Name = "qa:mvp"; Command = "npm run qa:mvp" },
  @{ Name = "qa:inbox"; Command = "npm run qa:inbox" },
  @{ Name = "build"; Command = "npm run build -- --no-lint" },
  @{ Name = "qa:secrets-static"; Command = "npm run qa:secrets-static" }
)

$steps = if ($Mode -eq "full") { $fullSteps } else { $quickSteps }
$results = @()

function Get-ListenerOn3000 {
  return netstat -ano | Where-Object { $_ -match '^\s*TCP\s+\S+:3000\s+\S+\s+LISTENING\s+\d+\s*$' } | Select-Object -First 1
}

function Get-ListenerPidsOn3000 {
  $lines = netstat -ano | Where-Object { $_ -match '^\s*TCP\s+\S+:3000\s+\S+\s+LISTENING\s+\d+\s*$' }
  $pids = @()
  foreach ($line in $lines) {
    if ($line -match '\s(\d+)\s*$') {
      $pids += [int]$Matches[1]
    }
  }
  return $pids | Sort-Object -Unique
}

function Clear-NextArtifacts {
  $distDirName = if ([string]::IsNullOrWhiteSpace($env:TASKFLOW_QA_DIST_DIR)) { ".next" } else { $env:TASKFLOW_QA_DIST_DIR.Trim() }
  $nextPath = Join-Path $root $distDirName
  if (-not (Test-Path -LiteralPath $nextPath)) {
    return
  }

  $resolvedNext = (Resolve-Path -LiteralPath $nextPath -ErrorAction Stop).Path
  if (-not $resolvedNext.StartsWith($root)) {
    throw "Refusing to delete outside workspace: $resolvedNext"
  }

  try {
    Remove-Item -LiteralPath $resolvedNext -Recurse -Force -ErrorAction Stop
  } catch {
    $reason = $_.Exception.Message
    Write-Warning "Skipping .next cleanup because file lock remained: $reason"
  }
}

function Stop-ServerOn3000 {
  $pids = Get-ListenerPidsOn3000
  if (-not $pids) {
    return
  }

  foreach ($processId in $pids) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }

  Start-Sleep -Seconds 2
}

function Ensure-DemoDevServer {
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "-p", "3000") -WorkingDirectory $root -WindowStyle Normal

  $maxAttempts = 45
  for ($attempt = 0; $attempt -lt $maxAttempts; $attempt++) {
    Start-Sleep -Seconds 1
    try {
      $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method Get -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      # keep waiting
    }
  }

  throw "Demo dev server did not become ready on :3000."
}

if ($Mode -eq "full") {
  $existingServer = Get-ListenerOn3000
  if ($existingServer) {
    Write-Host "Using existing dev server on :3000"
  } else {
    Clear-NextArtifacts
    Ensure-DemoDevServer
  }
}

foreach ($step in $steps) {
  if ($step.Name -eq "build") {
    Stop-ServerOn3000
  }

  Write-Host ""
  Write-Host "=== $($step.Name) ==="
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $exitCode = 0

  try {
    if ($step.Name -eq "build") {
      $buildOutLog = Join-Path $root "qa-build.out.log"
      $buildErrLog = Join-Path $root "qa-build.err.log"
      if (Test-Path -LiteralPath $buildOutLog) { Remove-Item -LiteralPath $buildOutLog -Force -ErrorAction SilentlyContinue }
      if (Test-Path -LiteralPath $buildErrLog) { Remove-Item -LiteralPath $buildErrLog -Force -ErrorAction SilentlyContinue }
      $buildProcess = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "build", "--", "--no-lint") -WorkingDirectory $root -RedirectStandardOutput $buildOutLog -RedirectStandardError $buildErrLog -Wait -PassThru
      $exitCode = $buildProcess.ExitCode
      if ($exitCode -ne 0) {
        Write-Warning "Primary build launch failed with exit code $exitCode. Retrying inline build command..."
        Invoke-Expression "npm run build -- --no-lint"
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) { $exitCode = 0 }
      }
    } else {
      Invoke-Expression $step.Command
      $exitCode = $LASTEXITCODE
      if ($null -eq $exitCode) { $exitCode = 0 }
    }
  } catch {
    $exitCode = 1
    Write-Host $_ -ForegroundColor Red
  } finally {
    $sw.Stop()
  }

  $ok = ($exitCode -eq 0)
  $results += [PSCustomObject]@{
    Step       = $step.Name
    Command    = $step.Command
    Result     = $(if ($ok) { "PASS" } else { "FAIL" })
    ExitCode   = $exitCode
    DurationMs = [int]$sw.ElapsedMilliseconds
  }

  Write-Host ("[{0}] {1} ({2}ms)" -f $(if ($ok) { "PASS" } else { "FAIL" }), $step.Name, [int]$sw.ElapsedMilliseconds)

  if (-not $ok) {
    break
  }
}

$overallPass = ($results.Count -eq $steps.Count) -and (($results | Where-Object { $_.Result -eq "FAIL" }).Count -eq 0)
$overall = if ($overallPass) { "PASS" } else { "FAIL" }

$lines = @()
$lines += "# Local Release Gate Report"
$lines += ""
$lines += "- Timestamp: $(Get-Date -Format o)"
$lines += "- Mode: $Mode"
$lines += "- Overall: $overall"
$lines += "- Workspace: $root"
$lines += "- DistDir: $qaDistDirName"
$lines += ""
$lines += "## Step Results"
$lines += ""
$lines += "| Step | Command | Result | Exit Code | Duration(ms) |"
$lines += "|---|---|---|---:|---:|"
foreach ($result in $results) {
  $lines += "| $($result.Step) | `$($result.Command)` | $($result.Result) | $($result.ExitCode) | $($result.DurationMs) |"
}
$lines += ""
$lines += "## Notes"
$lines += ""
$lines += "- `quick`: 速い事前確認（lint/typecheck + preprod静的確認）。"
$lines += "- `full`: MVP導線/Inbox導線/build/静的秘密値漏えいチェックまで実施。"
$lines += "- QA実行中は distDir に `$env:TASKFLOW_QA_DIST_DIR` を使用して OneDrive `.next` ロックの影響を下げます。"
$lines += "- OneDrive環境ではビルド成果物がロックされる場合があります。失敗時は dev server停止後に再実行してください。"

Set-Content -LiteralPath $reportPath -Value $lines -Encoding UTF8
Write-Host ""
Write-Host "Report: $reportPath"

if (-not $overallPass) {
  exit 1
}
