#!/usr/bin/env bash
# PreToolUse (Edit|Write): AGENTS.md — генерируемое зеркало CLAUDE.md.
# Прямую правку зеркала блокируем и отправляем в канон.
set -uo pipefail

path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -n "$path" ] || exit 0
[ "$(basename "$path")" = "AGENTS.md" ] || exit 0

jq -nc '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason:
      "AGENTS.md — зеркало CLAUDE.md, править напрямую нельзя. Внеси правку в CLAUDE.md, затем: python3 scripts/sync_agent_docs.py"
  }
}'
