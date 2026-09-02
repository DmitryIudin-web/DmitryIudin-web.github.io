<#
.SYNOPSIS
    Read-only audit of the local agent tooling on a Windows workstation.

.DESCRIPTION
    Answers two questions that cannot be answered from a cloud session:
      1. Is there anything named "Hermes" on this machine, and what is it?
      2. What is the state of the Claude Code / Codex desktop tooling,
         including why the remote-control bridge is offline?

    The script only reads. It creates no files outside the report, changes no
    settings, starts and stops nothing, and needs no administrator rights.

.NOTES
    This file is deliberately pure ASCII - no byte above 0x7F anywhere.

    An earlier version carried Russian text and failed to run: Windows
    PowerShell 5.1 reads a .ps1 without a UTF-8 BOM in the system ANSI
    codepage, which turned every non-ASCII literal into mojibake and broke
    tokenisation outright. A BOM fixes that, but only for as long as nobody
    saves the file back without one. Staying inside ASCII removes the failure
    mode instead of guarding against it, so the script runs the same under
    Windows PowerShell 5.1 and PowerShell 7, with or without a BOM, under any
    system codepage.

    Keep it that way: do not add non-ASCII characters to this file.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\hermes-audit.ps1

    The report is printed and also written to hermes-audit.txt on the Desktop.
#>

[CmdletBinding()]
param(
    # Extra roots to scan for a Hermes install, e.g. -SearchRoots 'E:\','F:\projects'
    [string[]] $SearchRoots = @(),

    # Where to write the report.
    [string] $ReportPath = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'hermes-audit.txt')
)

$ErrorActionPreference = 'Continue'
$lines = New-Object System.Collections.Generic.List[string]

function Add-Line {
    param([string] $Text = '')
    $lines.Add($Text) | Out-Null
}

function Add-Section {
    param([string] $Title)
    Add-Line
    Add-Line ('=' * 72)
    Add-Line "  $Title"
    Add-Line ('=' * 72)
}

# Runs a probe and records whatever it produces, including the failure.
# A section that cannot be collected must say so rather than silently vanish.
function Add-Probe {
    param(
        [string] $Label,
        [scriptblock] $Probe
    )
    Add-Line
    Add-Line "-- $Label"
    try {
        $out = & $Probe | Out-String -Width 200
        if ([string]::IsNullOrWhiteSpace($out)) { Add-Line '   (empty)' }
        else { Add-Line $out.TrimEnd() }
    }
    catch {
        Add-Line "   ERROR: $($_.Exception.Message)"
    }
}

Add-Line 'Agent audit on this workstation'
Add-Line "Collected: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
Add-Line "Host: $env:COMPUTERNAME    User: $env:USERNAME"

# ---------------------------------------------------------------------------
Add-Section 'Environment'

Add-Probe 'Windows and PowerShell' {
    [PSCustomObject]@{
        OS        = (Get-CimInstance Win32_OperatingSystem).Caption
        Build     = [Environment]::OSVersion.Version.ToString()
        PSVersion = $PSVersionTable.PSVersion.ToString()
        Is64Bit   = [Environment]::Is64BitOperatingSystem
        LastBoot  = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
    } | Format-List
}

Add-Probe 'Administrator rights' {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $isAdmin = ([Security.Principal.WindowsPrincipal] $id).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
    "IsAdmin: $isAdmin  (this audit does not need them)"
}

Add-Probe 'Drives' {
    Get-PSDrive -PSProvider FileSystem | Select-Object `
        Name,
        @{ n = 'UsedGB'; e = { [math]::Round($_.Used / 1GB, 1) } },
        @{ n = 'FreeGB'; e = { [math]::Round($_.Free / 1GB, 1) } },
        @{ n = 'FreePct'; e = {
            $total = $_.Used + $_.Free
            if ($total -gt 0) { [math]::Round($_.Free / $total * 100, 1) }
        } },
        Root | Format-Table -AutoSize
}

# Installing onto D: was discussed separately - record whether it exists.
Add-Probe 'Drive D:' {
    if (Test-Path 'D:\') {
        $d = Get-PSDrive -Name D -ErrorAction Stop
        "D: exists. Free: $([math]::Round($d.Free / 1GB, 1)) GB."
        Get-ChildItem 'D:\' -Force -ErrorAction SilentlyContinue |
            Select-Object Mode, LastWriteTime, Name | Format-Table -AutoSize
    }
    else { 'D: NOT FOUND - nothing can be installed there.' }
}

# ---------------------------------------------------------------------------
Add-Section 'Search for Hermes'

$profileDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }

$roots = @('D:\', $profileDir, $env:LOCALAPPDATA, $env:APPDATA,
           'C:\ProgramData', 'C:\Program Files', 'C:\Program Files (x86)')
$roots += $SearchRoots
$roots = $roots | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

# Cyrillic "germes" is matched by escape sequence so this file stays ASCII.
$hermesPattern = "hermes|$([char]0x0433)$([char]0x0435)$([char]0x0440)$([char]0x043C)$([char]0x0435)$([char]0x0441)"

Add-Probe "Files and folders named hermes (roots: $($roots -join ', '))" {
    if (-not $roots) {
        'NOT SEARCHED: none of the search roots exist on this machine.'
        return
    }
    $hits = foreach ($root in $roots) {
        Get-ChildItem -LiteralPath $root -Recurse -Force -Depth 4 `
                      -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match $hermesPattern } |
            Select-Object -First 40
    }
    if (-not $hits) { 'Nothing found.' }
    else {
        $hits | Select-Object -First 60 Mode, LastWriteTime,
            @{ n = 'SizeKB'; e = { if ($_.PSIsContainer) { '' } else { [math]::Round($_.Length / 1KB, 1) } } },
            FullName | Format-Table -AutoSize
    }
}

Add-Probe 'Installed programs with hermes in the name' {
    $keys = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    $found = Get-ItemProperty $keys -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -match 'hermes' } |
        Select-Object DisplayName, DisplayVersion, Publisher, InstallLocation
    if ($found) { $found | Format-List } else { 'Nothing found.' }
}

Add-Probe 'Processes and services matching hermes' {
    $p = Get-Process -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -match 'hermes' } |
         Select-Object Id, Name, @{ n = 'WS_MB'; e = { [math]::Round($_.WS / 1MB, 1) } }
    $s = Get-Service -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -match 'hermes' -or $_.DisplayName -match 'hermes' } |
         Select-Object Name, DisplayName, Status, StartType
    if ($p) { 'PROCESSES:'; $p | Format-Table -AutoSize } else { 'No processes.' }
    if ($s) { 'SERVICES:';  $s | Format-Table -AutoSize } else { 'No services.' }
}

# ---------------------------------------------------------------------------
Add-Section 'Claude Code'

Add-Probe 'Executable on PATH' {
    $cmd = Get-Command claude -ErrorAction SilentlyContinue
    if ($cmd) {
        "Found: $($cmd.Source)"
        try { "Version: $(& claude --version 2>&1)" }
        catch { "Could not read version: $($_.Exception.Message)" }
    }
    else { 'claude not found on PATH.' }
}

Add-Probe 'Directory ~/.claude' {
    $dir = Join-Path $profileDir '.claude'
    if (-not (Test-Path $dir)) { 'Directory missing.'; return }
    Get-ChildItem $dir -Force -ErrorAction SilentlyContinue |
        Select-Object Mode, LastWriteTime,
            @{ n = 'SizeKB'; e = { if ($_.PSIsContainer) { '' } else { [math]::Round($_.Length / 1KB, 1) } } },
            Name | Format-Table -AutoSize
}

# The remote-control bridge is what the stalled cloud sessions are waiting on.
Add-Probe 'Node / Claude processes (remote-control bridge candidates)' {
    $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'node|claude|bun' } |
        Select-Object ProcessId, Name,
            @{ n = 'CommandLine'; e = { if ($_.CommandLine) { $_.CommandLine.Substring(0, [Math]::Min(180, $_.CommandLine.Length)) } } }
    if ($procs) { $procs | Format-List } else { 'No matching processes running.' }
}

# ---------------------------------------------------------------------------
Add-Section 'Codex'

Add-Probe 'Directory ~/.codex' {
    $dir = Join-Path $profileDir '.codex'
    if (-not (Test-Path $dir)) { 'Directory missing.'; return }
    Get-ChildItem $dir -Recurse -Force -Depth 2 -ErrorAction SilentlyContinue |
        Select-Object Mode, LastWriteTime,
            @{ n = 'SizeKB'; e = { if ($_.PSIsContainer) { '' } else { [math]::Round($_.Length / 1KB, 1) } } },
            FullName | Format-Table -AutoSize
}

Add-Probe 'Contents of ~/.codex/automations' {
    $dir = Join-Path $profileDir '.codex\automations'
    if (-not (Test-Path $dir)) { 'Directory missing.'; return }
    Get-ChildItem $dir -Recurse -File -Force -ErrorAction SilentlyContinue |
        Select-Object LastWriteTime, @{ n = 'SizeKB'; e = { [math]::Round($_.Length / 1KB, 1) } }, FullName |
        Format-Table -AutoSize
}

# ---------------------------------------------------------------------------
Add-Section 'Scheduled tasks'

Add-Probe 'Tasks matching the project keywords' {
    $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue |
        Where-Object { $_.TaskName -match 'claude|codex|hermes|ast|health|radar|digest|kontur|content' }
    if (-not $tasks) { 'No matches.'; return }
    $tasks | ForEach-Object {
        $info = Get-ScheduledTaskInfo -TaskName $_.TaskName -TaskPath $_.TaskPath -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            Name       = $_.TaskName
            State      = $_.State
            LastRun    = $info.LastRunTime
            LastResult = $info.LastTaskResult   # 0 = success
            NextRun    = $info.NextRunTime
        }
    } | Format-Table -AutoSize
}

# ---------------------------------------------------------------------------
Add-Section 'Summary'

Add-Line
Add-Line 'The sections above answer two questions:'
Add-Line '  1. Whether anything named Hermes exists here - see the search section.'
Add-Line '  2. Why the bridge to the cloud sessions is down - see the Node/Claude'
Add-Line '     process list. If no matching process is running, the agent is simply'
Add-Line '     not started, and every session waiting for approval stays blocked.'
Add-Line
Add-Line 'This script changed nothing. Please send the whole report back.'
Add-Line

$report = $lines -join [Environment]::NewLine
Write-Output $report

try {
    $report | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    Write-Output ''
    Write-Output "Report saved to: $ReportPath"
}
catch {
    Write-Warning "Could not write the report to '$ReportPath': $($_.Exception.Message)"
}
