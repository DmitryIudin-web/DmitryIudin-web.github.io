#!/usr/bin/env python3
"""Включает git-хуки репозитория и пересоздаёт ignore-файлы агентов.

Работает одинаково в Windows (PowerShell, cmd, VS Code), macOS и Linux.
Запускать один раз после клонирования, из любой папки внутри репозитория:

    python scripts/install_hooks.py      # Windows
    python3 scripts/install_hooks.py     # macOS / Linux

Что делает:
  1. git config core.hooksPath .githooks — pre-commit запускает
     scripts/check.py --staged перед каждым коммитом;
  2. копирует scripts/agent-ignore.txt в .clineignore, .rooignore и др.
     (байт в байт, переводы строк не меняются).
"""
import os
import stat
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IGNORE_FILES = (".aiderignore", ".clineignore", ".rooignore", ".kilocodeignore",
                ".cursorignore", ".codeiumignore", ".geminiignore", ".continueignore")


def main() -> int:
    try:
        subprocess.run(["git", "config", "core.hooksPath", ".githooks"], cwd=ROOT, check=True)
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"ОШИБКА: не удалось настроить git ({e}). Git установлен?", file=sys.stderr)
        return 1
    for hook in (ROOT / ".githooks").iterdir():
        if os.name != "nt":
            hook.chmod(hook.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    print("core.hooksPath = .githooks (pre-commit -> scripts/check.py --staged)")

    source = (ROOT / "scripts" / "agent-ignore.txt").read_bytes()
    for name in IGNORE_FILES:
        (ROOT / name).write_bytes(source)
    print("ignore-файлы агентов синхронизированы с scripts/agent-ignore.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
