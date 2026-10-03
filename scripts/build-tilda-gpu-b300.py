#!/usr/bin/env python3
"""Собирает пакет для переноса /gpu-server-hgx-b300/ на боевой avtonds.ru (Tilda).

Боевой сайт работает на Tilda, статический снапшот в этом репозитории —
staging. Страница переносится вручную через браузер, а этот скрипт готовит
код для вставки, чтобы он не расходился со снапшотом:

    docs/gpu-server-hgx-b300/tilda/head.html — поле страницы «HTML-код для HEAD»
    docs/gpu-server-hgx-b300/tilda/body.html — блок T123 «HTML-код»

Запуск после любой правки gpu-server-hgx-b300/index.html:
    python3 scripts/build-tilda-gpu-b300.py

Пересборку проверяет `--check`: ненулевой код, если файлы разошлись с исходной
страницей (тогда скрипт нужно перезапустить и закоммитить результат).
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'gpu-server-hgx-b300' / 'index.html'
OUT = ROOT / 'docs' / 'gpu-server-hgx-b300' / 'tilda'

HEAD_NOTE = """<!--
  Вставить в: страница Tilda → Настройки страницы → «HTML-код для HEAD».
  Собрано скриптом scripts/build-tilda-gpu-b300.py из gpu-server-hgx-b300/index.html —
  вручную не править, правь исходную страницу и пересобери.

  Что здесь: шрифты, разметка Schema.org (Product + FAQPage) и счётчик Метрики.
  Title, description, canonical и Open Graph в этот файл НЕ входят —
  их вписывают в поля SEO самой страницы Tilda:

    Заголовок:  Сервер NVIDIA HGX B300 8-GPU под заказ | АСТ
    Описание:   {description}
    Canonical:  https://avtonds.ru/gpu-server-hgx-b300/

  Если счётчик Метрики уже подключён на уровне сайта (Настройки сайта →
  Аналитика), блок между «НАЧАЛО СЧЁТЧИКА» и «КОНЕЦ СЧЁТЧИКА» нужно удалить,
  иначе визиты задвоятся.
-->
"""

BODY_NOTE = """<!--
  Вставить в: блок T123 «HTML-код» на странице Tilda.
  Собрано скриптом scripts/build-tilda-gpu-b300.py из gpu-server-hgx-b300/index.html —
  вручную не править, правь исходную страницу и пересобери.

  Внутри размечены границы нашей шапки и подвала. Если страница показывает
  общие шапку и подвал сайта — удали наши блоки; если общие не нужны —
  отключи их в настройках страницы Tilda.

  Атрибуты страницы (data-offer, data-ast-message, data-ast-phone…) со снятого
  тега <body> перенесены на обёртку <div id="ast-gpu-b300">: рантайм
  assets/ast-conversion.js читает их с body, поэтому на Tilda их нужно
  продублировать в поле «Атрибуты тега body» (Настройки страницы → Дополнительно)
  или оставить как есть — тогда общая липкая панель покажет общий номер сайта.
-->
"""


def extract(html: str) -> tuple[str, str, str]:
    head = html[html.index('<head>') + len('<head>'):html.index('</head>')]
    body_open = html.index('<body')
    body_start = html.index('>', body_open) + 1
    body = html[body_start:html.index('</body>')]
    body_attrs = html[body_open + len('<body'):body_start - 1].strip()
    return head, body, body_attrs


def build_head(head: str) -> str:
    keep = []
    # Шрифты
    keep += re.findall(r'<link rel="preconnect"[^>]*>', head)
    keep += re.findall(r'<link href="https://fonts\.googleapis\.com[^>]*>', head)
    # Schema.org
    keep += re.findall(r'<script type="application/ld\+json">.*?</script>', head, re.S)
    # Метрика — в рамке, чтобы её было легко убрать
    counter = re.search(r'<script>\s*\(function\(m,e,t,r,i,k,a\).*?</script>', head, re.S)
    if counter:
        keep.append('<!-- НАЧАЛО СЧЁТЧИКА МЕТРИКИ -->\n'
                    + counter.group(0)
                    + '\n<!-- КОНЕЦ СЧЁТЧИКА МЕТРИКИ -->')
    description = re.search(r'<meta name="description" content="([^"]+)"', head)
    note = HEAD_NOTE.format(description=description.group(1) if description else '')
    return note + '\n'.join(keep) + '\n'


def build_body(body: str, body_attrs: str) -> str:
    out = body
    # Счётчик без JS и подключение рантайма ссылкой на Tilda не работают.
    out = re.sub(r'<noscript>.*?</noscript>', '', out, flags=re.S)
    out = re.sub(r'<link rel="stylesheet" href="/assets/ast-conversion[^>]*>', '', out)
    out = re.sub(r'<script src="/assets/ast-conversion[^>]*></script>', '', out)
    out = out.replace('<header class="top">', '<!-- НАЧАЛО НАШЕЙ ШАПКИ -->\n  <header class="top">')
    out = out.replace('</header>', '</header>\n  <!-- КОНЕЦ НАШЕЙ ШАПКИ -->', 1)
    out = out.replace('<footer>', '<!-- НАЧАЛО НАШЕГО ПОДВАЛА -->\n  <footer>')
    out = out.replace('</footer>', '</footer>\n  <!-- КОНЕЦ НАШЕГО ПОДВАЛА -->', 1)
    return (BODY_NOTE
            + f'<div id="ast-gpu-b300" {body_attrs}>\n'
            + out.strip()
            + '\n</div>\n')


def main() -> int:
    check_only = '--check' in sys.argv[1:]
    html = SRC.read_text(encoding='utf-8')
    head_src, body_src, body_attrs = extract(html)
    files = {
        OUT / 'head.html': build_head(head_src),
        OUT / 'body.html': build_body(body_src, body_attrs),
    }
    stale = [p for p, text in files.items()
             if not p.exists() or p.read_text(encoding='utf-8') != text]
    if check_only:
        for p in stale:
            print(f'stale: {p.relative_to(ROOT)} — перезапусти без --check')
        print('OK: пакет Tilda совпадает со страницей' if not stale else '')
        return 1 if stale else 0
    OUT.mkdir(parents=True, exist_ok=True)
    for p, text in files.items():
        p.write_text(text, encoding='utf-8')
        print(f'wrote {p.relative_to(ROOT)}: {p.stat().st_size} bytes')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
