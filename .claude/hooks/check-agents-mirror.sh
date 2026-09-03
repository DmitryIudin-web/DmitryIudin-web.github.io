#!/usr/bin/env bash
# Stop: предупредить, если AGENTS.md разошёлся с CLAUDE.md.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f scripts/sync_agent_docs.py ] || exit 0

if ! python3 scripts/sync_agent_docs.py --check >/dev/null 2>&1; then
  jq -nc '{systemMessage: "AGENTS.md разошёлся с CLAUDE.md — запустите: python3 scripts/sync_agent_docs.py"}'
fi
exit 0
