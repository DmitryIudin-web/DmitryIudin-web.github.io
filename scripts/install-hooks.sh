#!/usr/bin/env bash
# Включает git-хуки репозитория (.githooks/) и пересоздаёт ignore-файлы агентов
# из scripts/agent-ignore.txt. Запускать один раз после клонирования:
#     bash scripts/install-hooks.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true
echo "core.hooksPath = .githooks (pre-commit -> python3 scripts/check.py --staged)"

for f in .aiderignore .clineignore .rooignore .kilocodeignore .cursorignore \
         .codeiumignore .geminiignore .continueignore; do
  cp scripts/agent-ignore.txt "$f"
done
echo "ignore-файлы агентов синхронизированы с scripts/agent-ignore.txt"
