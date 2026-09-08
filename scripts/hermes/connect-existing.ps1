# Connect an existing Windows profile; does not reinstall or restart Hermes.
[CmdletBinding()]
param(
    [string]$HermesHome = $env:HERMES_HOME,
    [string]$RuntimeDir,
    [string]$Workspace,
    [string]$Python,
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
if (-not $Workspace) {
    $Workspace = Join-Path $PSScriptRoot '..\..'
}

if (-not $RuntimeDir) {
    $taskHermesCommand = Get-Command hermes -ErrorAction Stop
    $RuntimeDir = ([IO.FileInfo]$taskHermesCommand.Source).Directory.Parent.Parent.FullName
}
$RuntimeDir = (Resolve-Path -LiteralPath $RuntimeDir).Path
if (-not $HermesHome) {
    $HermesHome = Join-Path (Split-Path -Parent $RuntimeDir) '.hermes'
}
$HermesHome = (Resolve-Path -LiteralPath $HermesHome).Path
$Workspace = (Resolve-Path -LiteralPath $Workspace).Path
if (-not $Python) {
    $Python = Join-Path $RuntimeDir 'venv\Scripts\python.exe'
}
if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
    throw 'Existing Hermes Python was not found. Specify -RuntimeDir and -Python.'
}
if (-not (Test-Path -LiteralPath (Join-Path $HermesHome 'config.yaml') -PathType Leaf)) {
    throw 'This command requires an existing config.yaml; use bootstrap-vps.sh for a new server.'
}

$taskProfileTool = Join-Path $PSScriptRoot 'profile.py'
& $Python $taskProfileTool capabilities --runtime $RuntimeDir
if ($LASTEXITCODE -notin @(0, 2)) { exit $LASTEXITCODE }
if ($LASTEXITCODE -eq 2) {
    Write-Warning 'This runtime does not support the publishing deny policy. Applying the profile will not upgrade or restart it.'
}
$taskArguments = @($taskProfileTool, 'apply', '--home', $HermesHome, '--workspace', $Workspace, '--mode', 'existing')
if (-not $Apply) { $taskArguments += '--dry-run' }
& $Python @taskArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not $Apply) {
    Write-Output 'Preview only. Use -Apply to connect the profile; no process will be restarted.'
    exit 0
}

# Configuration application and runtime enforcement are different results.
# Legacy 0.17 remains running, but this read-back returns 2 until upgraded.
& $Python $taskProfileTool check --home $HermesHome --runtime $RuntimeDir
$taskCheckExit = $LASTEXITCODE
if ($taskCheckExit -eq 2) {
    Write-Warning 'Profile connected; runtime enforcement is not ready. Review the reported issues before relying on the policy.'
}
exit $taskCheckExit
