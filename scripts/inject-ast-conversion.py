#!/usr/bin/env python3
"""Подключает рантайм Этапа 1 (assets/ast-conversion.*) на все HTML-страницы.

Идемпотентен: страницы, где сниппет уже есть, пропускаются. Работает с байтами,
чтобы не менять ничего, кроме вставки сниппета перед </body> (в репозитории
действует `* -text`, байты статического пакета сохраняются как есть).

Запуск: python3 scripts/inject-ast-conversion.py [--check]
Используется вручную и workflow'ом inject-ast-conversion — в т.ч. для
повторного подключения после обновления снапшота из Tilda.
"""
import pathlib
import sys

SNIPPET = (
    b'<!-- AST conversion etap1 start -->'
    b'<link rel="stylesheet" href="/assets/ast-conversion.css?v=20260901">'
    b'<script src="/assets/ast-conversion.js?v=20260901" defer></script>'
    b'<!-- AST conversion etap1 end -->'
)


def main() -> int:
    check_only = '--check' in sys.argv[1:]
    changed, present, skipped = [], 0, []
    for path in sorted(pathlib.Path('.').rglob('*.html')):
        if '.git' in path.parts:
            continue
        data = path.read_bytes()
        if b'ast-conversion.js' in data:
            present += 1
            continue
        if data.count(b'</body>') != 1:
            skipped.append(str(path))
            continue
        if not check_only:
            path.write_bytes(data.replace(b'</body>', SNIPPET + b'</body>'))
        changed.append(str(path))
    print(f'already included: {present}, {"missing" if check_only else "injected"}: {len(changed)}')
    for p in changed:
        print(('  missing: ' if check_only else '  injected: ') + p)
    for p in skipped:
        print('  SKIPPED (unexpected </body> count): ' + p)
    return 1 if (check_only and changed) or skipped else 0


if __name__ == '__main__':
    raise SystemExit(main())
