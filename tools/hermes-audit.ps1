<#
.SYNOPSIS
    Read-only audit of the local agent tooling on a Windows workstation.

.DESCRIPTION
    Answers two questions that cannot be answered from a cloud session:
      1. Is there anything named "Hermes" on this machine, and what is it?
      2. What is the actual state of the Claude Code / Codex desktop tooling,
         including why the remote-control bridge is offline?

    The script only reads. It creates no files outside the report, changes no
    settings, starts and stops nothing, and needs no administrator rights.

.NOTES
    Этот файл ДОЛЖЕН сохраняться в UTF-8 С BOM. Windows PowerShell 5.1 читает
    .ps1 без BOM в кодировке системы, отчего все кириллические строки
    рассыпаются и скрипт перестаёт разбираться. PowerShell 7 читает UTF-8
    и без BOM, но BOM не мешает и ему.

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

# Консоль Windows по умолчанию не в UTF-8, из-за чего кириллица в выводе
# превращается в мусор. Отчёт на диск это не портит, но читать на экране мешает.
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
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
        if ([string]::IsNullOrWhiteSpace($out)) { Add-Line '   (пусто)' }
        else { Add-Line $out.TrimEnd() }
    }
    catch {
        Add-Line "   ОШИБКА: $($_.Exception.Message)"
    }
}

Add-Line "Аудит агентов на рабочей станции"
Add-Line "Собран: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
Add-Line "Хост: $env:COMPUTERNAME    Пользователь: $env:USERNAME"

# ---------------------------------------------------------------------------
Add-Section 'Окружение'

Add-Probe 'Windows и PowerShell' {
    [PSCustomObject]@{
        OS         = (Get-CimInstance Win32_OperatingSystem).Caption
        Build      = [Environment]::OSVersion.Version.ToString()
        PSVersion  = $PSVersionTable.PSVersion.ToString()
        Is64Bit    = [Environment]::Is64BitOperatingSystem
        LastBoot   = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
    } | Format-List
}

Add-Probe 'Права администратора' {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $isAdmin = ([Security.Principal.WindowsPrincipal] $id).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
    "IsAdmin: $isAdmin  (для этого аудита права не нужны)"
}

Add-Probe 'Диски' {
    Get-PSDrive -PSProvider FileSystem | Select-Object `
        Name,
        @{ n = 'UsedGB';  e = { [math]::Round($_.Used / 1GB, 1) } },
        @{ n = 'FreeGB';  e = { [math]::Round($_.Free / 1GB, 1) } },
        @{ n = 'Free%';   e = {
            $total = $_.Used + $_.Free
            if ($total -gt 0) { [math]::Round($_.Free / $total * 100, 1) }
        } },
        Root | Format-Table -AutoSize
}

# Установка на D: обсуждалась отдельно — фиксируем, существует ли диск вообще.
Add-Probe 'Диск D:' {
    if (Test-Path 'D:\') {
        $d = Get-PSDrive -Name D -ErrorAction Stop
        "D: существует. Свободно $([math]::Round($d.Free / 1GB, 1)) ГБ."
        Get-ChildItem 'D:\' -Force -ErrorAction SilentlyContinue |
            Select-Object Mode, LastWriteTime, Name | Format-Table -AutoSize
    }
    else { 'D: НЕ НАЙДЕН — ставить агента на этот диск нельзя.' }
}

# ---------------------------------------------------------------------------
Add-Section 'Поиск "Hermes" / "Гермес"'

# На Windows USERPROFILE задан всегда; запасной вариант нужен только чтобы
# скрипт не падал при запуске под кросс-платформенным PowerShell.
$profileDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }

$roots = @('D:\', $profileDir, $env:LOCALAPPDATA, $env:APPDATA,
           'C:\ProgramData', 'C:\Program Files', 'C:\Program Files (x86)')
$roots += $SearchRoots
$roots = $roots | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

Add-Probe "Файлы и папки с именем hermes (корни: $($roots -join ', '))" {
    if (-not $roots) {
        'НЕ ИСКАЛОСЬ: ни один корень для поиска не существует на этой машине.'
        return
    }
    $hits = foreach ($root in $roots) {
        Get-ChildItem -LiteralPath $root -Recurse -Force -Depth 4 `
                      -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match 'hermes|гермес' } |
            Select-Object -First 40
    }
    if (-not $hits) { 'Ничего не найдено.' }
    else {
        $hits | Select-Object -First 60 Mode, LastWriteTime,
            @{ n = 'SizeKB'; e = { if ($_.PSIsContainer) { '' } else { [math]::Round($_.Length / 1KB, 1) } } },
            FullName | Format-Table -AutoSize
    }
}

Add-Probe 'Установленные программы с "hermes" в названии' {
    $keys = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    $found = Get-ItemProperty $keys -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -match 'hermes' } |
        Select-Object DisplayName, DisplayVersion, Publisher, InstallLocation
    if ($found) { $found | Format-List } else { 'Ничего не найдено.' }
}

Add-Probe 'Процессы и службы с "hermes"' {
    $p = Get-Process -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -match 'hermes' } |
         Select-Object Id, Name, @{ n = 'WS_MB'; e = { [math]::Round($_.WS / 1MB, 1) } }
    $s = Get-Service -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -match 'hermes' -or $_.DisplayName -match 'hermes' } |
         Select-Object Name, DisplayName, Status, StartType
    if ($p) { 'ПРОЦЕССЫ:'; $p | Format-Table -AutoSize } else { 'Процессов нет.' }
    if ($s) { 'СЛУЖБЫ:';   $s | Format-Table -AutoSize } else { 'Служб нет.' }
}

# ---------------------------------------------------------------------------
Add-Section 'Claude Code'

Add-Probe 'Исполняемый файл в PATH' {
    $cmd = Get-Command claude -ErrorAction SilentlyContinue
    if ($cmd) {
        "Найден: $($cmd.Source)"
        try { "Версия: $(& claude --version 2>&1)" } catch { "Версию получить не удалось: $($_.Exception.Message)" }
    }
    else { 'claude в PATH не найден.' }
}

Add-Probe 'Каталог ~/.claude' {
    $dir = Join-Path $profileDir '.claude'
    if (-not (Test-Path $dir)) { 'Каталог отсутствует.'; return }
    Get-ChildItem $dir -Force -ErrorAction SilentlyContinue |
        Select-Object Mode, LastWriteTime,
            @{ n = 'SizeKB'; e = { if ($_.PSIsContainer) { '' } else { [math]::Round($_.Length / 1KB, 1) } } },
            Name | Format-Table -AutoSize
}

# Мост remote-control — это он лежит в основе зависших сессий.
Add-Probe 'Процессы Node / Claude (кандидаты на мост remote-control)' {
    $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'node|claude|bun' } |
        Select-Object ProcessId, Name,
            @{ n = 'CommandLine'; e = { if ($_.CommandLine) { $_.CommandLine.Substring(0, [Math]::Min(180, $_.CommandLine.Length)) } } }
    if ($procs) { $procs | Format-List } else { 'Подходящих процессов не запущено.' }
}

# ---------------------------------------------------------------------------
Add-Section 'Codex'

Add-Probe 'Каталог ~/.codex' {
    $dir = Join-Path $profileDir '.codex'
    if (-not (Test-Path $dir)) { 'Каталог отсутствует.'; return }
    Get-ChildItem $dir -Recurse -Force -Depth 2 -ErrorAction SilentlyContinue |
        Select-Object Mode, LastWriteTime,
            @{ n = 'SizeKB'; e = { if ($_.PSIsContainer) { '' } else { [math]::Round($_.Length / 1KB, 1) } } },
            FullName | Format-Table -AutoSize
}

Add-Probe 'Содержимое ~/.codex/automations' {
    $dir = Join-Path $profileDir '.codex\automations'
    if (-not (Test-Path $dir)) { 'Каталог отсутствует.'; return }
    Get-ChildItem $dir -Recurse -File -Force -ErrorAction SilentlyContinue |
        Select-Object LastWriteTime, @{ n = 'SizeKB'; e = { [math]::Round($_.Length / 1KB, 1) } }, FullName |
        Format-Table -AutoSize
}

# ---------------------------------------------------------------------------
Add-Section 'Планировщик заданий'

Add-Probe 'Задачи по ключевым словам проектов' {
    $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue |
        Where-Object { $_.TaskName -match 'claude|codex|hermes|гермес|ast|health|radar|digest|kontur|content' }
    if (-not $tasks) { 'Совпадений нет.'; return }
    $tasks | ForEach-Object {
        $info = Get-ScheduledTaskInfo -TaskName $_.TaskName -TaskPath $_.TaskPath -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            Name       = $_.TaskName
            State      = $_.State
            LastRun    = $info.LastRunTime
            LastResult = $info.LastTaskResult   # 0 = успех
            NextRun    = $info.NextRunTime
        }
    } | Format-Table -AutoSize
}

# ---------------------------------------------------------------------------
Add-Section 'Итог'

Add-Line
Add-Line 'Разделы выше отвечают на два вопроса:'
Add-Line '  1. Есть ли на машине что-то по имени Hermes — см. раздел поиска.'
Add-Line '  2. Почему мост до облачных сессий не поднят — см. процессы Node/Claude.'
Add-Line '     Если подходящих процессов нет, агент просто не запущен, и все'
Add-Line '     ожидающие подтверждения сессии останутся заблокированными.'
Add-Line
Add-Line 'Скрипт ничего не изменил. Пришлите этот отчёт целиком.'
Add-Line

$report = $lines -join [Environment]::NewLine
Write-Output $report

try {
    $report | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    Write-Output ""
    Write-Output "Отчёт сохранён: $ReportPath"
}
catch {
    Write-Warning "Не удалось записать отчёт в '$ReportPath': $($_.Exception.Message)"
}
