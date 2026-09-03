#!/usr/bin/env python3
"""Синхронизация CLAUDE.md -> AGENTS.md.

CLAUDE.md — канонический файл инструкций для агентов. AGENTS.md — его
байтовая копия для Codex и других агентов, читающих AGENTS.md.

    python3 scripts/sync_agent_docs.py            # переписать AGENTS.md из CLAUDE.md
    python3 scripts/sync_agent_docs.py --check    # только проверить (код 1 при расхождении)

Файлы читаются и пишутся в бинарном режиме: репозиторий помечен `* -text`
в .gitattributes, переводы строк менять нельзя.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CANON = ROOT / "CLAUDE.md"
MIRROR = ROOT / "AGENTS.md"


def main() -> int:
    check = "--check" in sys.argv[1:]

    if not CANON.exists():
        print(f"ОШИБКА: нет канонического файла {CANON.name}", file=sys.stderr)
        return 2

    canon = CANON.read_bytes()
    mirror = MIRROR.read_bytes() if MIRROR.exists() else None

    if canon == mirror:
        print("OK: AGENTS.md совпадает с CLAUDE.md")
        return 0

    if check:
        print(
            "РАСХОЖДЕНИЕ: AGENTS.md не совпадает с CLAUDE.md.\n"
            "Правьте CLAUDE.md (канон), затем: python3 scripts/sync_agent_docs.py",
            file=sys.stderr,
        )
        return 1

    MIRROR.write_bytes(canon)
    print(f"AGENTS.md обновлён из CLAUDE.md ({len(canon)} байт)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
