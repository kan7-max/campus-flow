param(
  [string]$ExportDir = (Join-Path $env:TEMP "campus-flow-public-release"),
  [switch]$SkipDependencyInstall
)

$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand([string]$Name, [string]$FilePath, [string[]]$ArgumentList) {
  Write-Output "==> $Name"
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
}

$fullExport = [System.IO.Path]::GetFullPath($ExportDir)
if (-not (Test-Path -LiteralPath $fullExport)) {
  throw "Export directory does not exist: $fullExport"
}

Push-Location -LiteralPath $fullExport
try {
  Invoke-CheckedCommand "Verify export is a Git repository" "git" @("rev-parse", "--is-inside-work-tree")

  $commitCount = (git rev-list --count --all).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to count export commits."
  }
  if ($commitCount -ne "1") {
    throw "Expected a history-free export with exactly 1 commit, found $commitCount commits."
  }
  Write-Output "==> Git history contains exactly 1 commit"

  $commitIdentities = git log --all --format="%an <%ae>`n%cn <%ce>"
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect commit identities."
  }
  $allowedEmail = "campusflow.official@gmail.com"
  $privateIdentityPattern = '([k]ajid|[k]ajidan|[g]mail\.com|[o]utlook\.com|[h]otmail\.com)'
  $privateIdentities = @(
    $commitIdentities |
      Where-Object { $_ -match $privateIdentityPattern -and $_ -notmatch [regex]::Escape($allowedEmail) }
  )
  if ($privateIdentities.Count -gt 0) {
    $privateIdentities | Write-Output
    throw "Potential personal commit identity found in public export."
  }
  Write-Output "==> Commit identity is public-safe"

  $status = git status --short
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read export Git status."
  }
  if ($status) {
    $status | Write-Output
    throw "Export worktree is not clean."
  }
  Write-Output "==> Export worktree is clean"

  $trackedFiles = git ls-tree -r --name-only HEAD
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to list tracked export files."
  }

  $forbiddenTrackedPattern = '(^|/)(\.env|\.env\.local|\.vercel|\.taskflow-demo-store.*|AGENTS\.md|CLAUDE\.md|TOOLS_INSTALLED\.md|package\.json\.bak|extract_from_file_out\.json|signin-search\.txt|signout-search\.txt)$|^(data|content)/'
  $forbiddenTrackedFiles = @($trackedFiles | Where-Object { $_ -match $forbiddenTrackedPattern })
  if ($forbiddenTrackedFiles.Count -gt 0) {
    $forbiddenTrackedFiles | Write-Output
    throw "Forbidden tracked files found in public export."
  }
  Write-Output "==> No forbidden tracked files found"

  $requiredFiles = @(
    "LICENSE",
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    ".github/dependabot.yml",
    "docs/public-repository-safety-checklist.md",
    "docs/openai-codex-oss-application-draft.md",
    "docs/public-release-readiness-report.md",
    "scripts/create-public-release-export.ps1",
    "scripts/verify-public-release-export.ps1"
  )
  foreach ($requiredFile in $requiredFiles) {
    if (-not ($trackedFiles -contains $requiredFile)) {
      throw "Required public release file is missing: $requiredFile"
    }
  }
  Write-Output "==> Required OSS maintenance files are present"

  $secretPattern = '([s]k-[A-Za-z0-9_-]{20,}|[g]hp_[A-Za-z0-9_]{20,}|[g]ithub_pat_[A-Za-z0-9_]{20,}|[S]UPABASE_SERVICE_ROLE_KEY=\S+|[G]OOGLE_CLIENT_SECRET=\S+|[O]PENAI_API_KEY=\S+|[W]EB_PUSH_PRIVATE_KEY=\S+|[C]RON_SECRET=\S+|[A-Z]:\\Users\\[A-Za-z0-9._-]+|[O]BSIDIAN_VAULT_PATH=\S+|[k]ajid|[k]ajidan|[k]ajidan7@gmail\.com)'
  Write-Output "==> Scanning for secrets and local user paths"
  & rg -n --hidden --glob "!node_modules/**" --glob "!.git/**" $secretPattern .
  $rgExitCode = $LASTEXITCODE
  if ($rgExitCode -eq 0) {
    throw "Potential secrets or local user paths found in public export."
  }
  if ($rgExitCode -gt 1) {
    throw "Secret scan failed with exit code $rgExitCode."
  }
  Write-Output "==> Secret scan returned no matches"

  if (-not $SkipDependencyInstall) {
    Invoke-CheckedCommand "Install dependencies without lifecycle scripts" "npm" @("ci", "--ignore-scripts")
  }

  Invoke-CheckedCommand "Run lint and typecheck" "npm" @("run", "check")
  Invoke-CheckedCommand "Run npm audit" "npm" @("audit", "--audit-level=moderate")

  Write-Output ""
  Write-Output "Public release export verification passed:"
  Write-Output $fullExport
}
finally {
  Pop-Location
}
