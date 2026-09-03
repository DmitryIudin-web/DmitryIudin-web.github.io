#!/usr/bin/env python3
"""Собирает один файл для вставки в Tilda из assets/ast-conversion.{css,js}.

На Tilda путь /assets/... не существует, поэтому подключить рантайм ссылкой,
как в статическом снапшоте, нельзя — код вставляется инлайном.

Результат вставляется целиком в Tilda:
    Настройки сайта → Ещё → HTML-код для вставки внутрь BODY

Запуск после любой правки рантайма, чтобы вставляемый код не расходился
со снапшотом:
    python3 scripts/build-tilda-snippet.py
"""
import pathlib

OUT = pathlib.Path('build/tilda-body-snippet.html')


def main() -> int:
    css = pathlib.Path('assets/ast-conversion.css').read_text(encoding='utf-8')
    js = pathlib.Path('assets/ast-conversion.js').read_text(encoding='utf-8')

    # Закрывающий тег внутри строки в JS разорвал бы <script> — страхуемся.
    js = js.replace('</script>', '<\\/script>')

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        '<!-- AST conversion etap1 start -->\n'
        '<style>\n' + css + '\n</style>\n'
        '<script>\n' + js + '\n</script>\n'
        '<!-- AST conversion etap1 end -->\n',
        encoding='utf-8')
    print(f'wrote {OUT}: {OUT.stat().st_size} bytes')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
