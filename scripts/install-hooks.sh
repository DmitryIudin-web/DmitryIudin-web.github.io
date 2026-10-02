#!/usr/bin/env bash
# Совместимость: логика установки — в scripts/install_hooks.py (работает и в Windows).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec python3 scripts/install_hooks.py "$@"
