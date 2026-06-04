param(
  [string]$OutputDir = (Join-Path $env:TEMP "campus-flow-public-release"),
  [string]$CommitMessage = "Initial public release",
  [string]$AuthorName = "Campus Flow contributors",
  [string]$AuthorEmail = "campusflow.official@gmail.com"
)

$ErrorActionPreference = "Stop"

function Resolve-ExistingParent([string]$Path) {
  $parent = Split-Path -Parent $Path
  while ($parent -and -not (Test-Path -LiteralPath $parent)) {
    $parent = Split-Path -Parent $parent
  }
  if (-not $parent) {
    throw "No existing parent found for output path: $Path"
  }
  return (Resolve-Path -LiteralPath $parent).Path
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw "This script must run inside a Git repository."
}

$fullOutput = [System.IO.Path]::GetFullPath($OutputDir)
$existingParent = Resolve-ExistingParent $fullOutput

if (Test-Path -LiteralPath $fullOutput) {
  $resolvedOutput = (Resolve-Path -LiteralPath $fullOutput).Path
  if (-not ($resolvedOutput.StartsWith($existingParent))) {
    throw "Refusing to delete outside resolved parent: $resolvedOutput"
  }
  Remove-Item -LiteralPath $resolvedOutput -Recurse -Force
}

New-Item -ItemType Directory -Path $fullOutput | Out-Null

Push-Location -LiteralPath $repoRoot
try {
  $archivePath = Join-Path ([System.IO.Path]::GetTempPath()) ("campus-flow-public-release-" + [System.Guid]::NewGuid().ToString("N") + ".tar")

  git archive --format=tar -o $archivePath HEAD
  if ($LASTEXITCODE -ne 0) {
    throw "git archive failed."
  }

  tar -xf $archivePath -C $fullOutput
  if ($LASTEXITCODE -ne 0) {
    throw "tar extract failed."
  }
}
finally {
  Pop-Location
  if ($archivePath -and (Test-Path -LiteralPath $archivePath)) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}

Push-Location -LiteralPath $fullOutput
try {
  git init -b main | Out-Null
  git add .
  git -c user.name="$AuthorName" -c user.email="$AuthorEmail" commit -m $CommitMessage | Out-Null

  Write-Output "Public release export created:"
  Write-Output $fullOutput
  Write-Output ""
  Write-Output "Next manual GitHub steps:"
  Write-Output "1. Create a new empty public repository on GitHub."
  Write-Output "2. Run these commands from the export directory:"
  Write-Output "   git remote add origin https://github.com/<owner>/<repo>.git"
  Write-Output "   git push -u origin main"
}
finally {
  Pop-Location
}
