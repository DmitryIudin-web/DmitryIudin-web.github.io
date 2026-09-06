#!/usr/bin/env python3
"""Собирает пакет для переноса самодостаточной страницы снапшота в Tilda.

Из `<slug>/index.html` делает `docs/tilda-<slug>/head.html` и `body.html`
по той же схеме, что ручной пакет `docs/tilda-cullinan/`:

- head.html — всё содержимое <head>, кроме служебных тегов, которые Tilda
  задаёт сама (charset, viewport, title, description, robots, canonical,
  og:*, favicon, yandex-verification): остаются JSON-LD, theme-color,
  format-detection и прочие теги, которых у Tilda нет.
- body.html — <style> из head + всё содержимое <body> без блока подключения
  рантайма `/assets/ast-conversion.*` (на Tilda этого пути нет; рантайм
  подключается на весь сайт отдельно, см. docs/owner-manual-steps.md).
  Маркеры «НАЧАЛО/КОНЕЦ НАШЕЙ ШАПКИ / ПОДВАЛА» и «СЧЁТЧИК ЯНДЕКС.МЕТРИКИ /
  КОНЕЦ СЧЁТЧИКА» из страницы сохраняются: по ним в Tilda удаляют дубли.

Страница должна быть самодостаточной: без ссылок на /_astro/ и /frozen-assets/.
Запуск из корня репозитория:  python3 scripts/build-tilda-page.py auto-iz-bishkeka
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
RUNTIME_RE = re.compile(r'<!-- AST conversion etap1 start -->.*?<!-- AST conversion etap1 end -->', re.S)
STYLE_RE = re.compile(r'<style[^>]*>.*?</style>', re.S)
TILDA_OWN_RE = re.compile(
    r'<meta\s+charset[^>]*>|<meta\s+name="viewport"[^>]*>|<title>.*?</title>|'
    r'<meta\s+name="description"[^>]*>|<meta\s+name="robots"[^>]*>|<link\s+rel="canonical"[^>]*>|'
    r'<meta\s+property="og:[^"]*"[^>]*>|<link\s+rel="icon"[^>]*>|<meta\s+name="yandex-verification"[^>]*>|'
    r'<!--.*?-->',
    re.S,
)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    slug = sys.argv[1].strip('/')
    src = ROOT / slug / 'index.html'
    html = src.read_bytes().decode('utf-8')
    for forbidden in ('/_astro/', '/frozen-assets/'):
        if forbidden in html:
            print(f'{src}: страница ссылается на {forbidden} — в Tilda такого пути нет', file=sys.stderr)
            return 1
    nl = '\r\n' if '\r\n' in html else '\n'
    head = html[html.find('<head>') + len('<head>'):html.find('</head>')]
    body = html[html.find('<body>') + len('<body>'):html.rfind('</body>')]

    styles = STYLE_RE.findall(head)
    head_clean = STYLE_RE.sub('', head)
    head_clean = TILDA_OWN_RE.sub('', head_clean)
    head_clean = re.sub(r'(\r?\n){2,}', nl, head_clean).strip()

    if not RUNTIME_RE.search(body):
        print(f'{src}: нет блока AST conversion etap1 — страница не подключает рантайм', file=sys.stderr)
        return 1
    body_clean = RUNTIME_RE.sub('', body).strip()

    out = ROOT / 'docs' / f'tilda-{slug}'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'head.html').write_bytes((
        f'<!-- {slug}: HTML-код для HEAD страницы Tilda. SEO-поля (title, description, canonical, og) задаются в настройках страницы. -->{nl}'
        + head_clean + nl).encode('utf-8'))
    (out / 'body.html').write_bytes((
        f'<!-- {slug}: блок T123 «HTML-код». Рантайм /assets/ast-conversion.* не включён — он подключается на весь сайт. -->{nl}'
        + nl.join(styles) + nl + body_clean + nl).encode('utf-8'))
    print(f'wrote {out / "head.html"} ({(out / "head.html").stat().st_size} bytes), '
          f'{out / "body.html"} ({(out / "body.html").stat().st_size} bytes)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
