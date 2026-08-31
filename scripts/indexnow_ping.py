#!/usr/bin/env python3
"""Notify search engines (Yandex, Bing) via IndexNow about changed pages.

Usage: python3 scripts/indexnow_ping.py <changed-file> [<changed-file> ...]
Changed files are repo-relative paths (e.g. "catalog/index.html").
Each is mapped to its canonical https://avtonds.ru URL; non-page files are
ignored. URLs are submitted in one batch to api.indexnow.org.
"""
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://avtonds.ru"
HOST = "avtonds.ru"
KEY = "34fc4e47f3bbe579d269d28b3749796c"

CANONICAL_RE = re.compile(r'<link\s+rel="canonical"\s+href="([^"]+)"')


def canonical_of(rel: str) -> str | None:
    path = ROOT / rel
    if not path.is_file() or path.suffix != ".html":
        return None
    text = path.read_text(encoding="utf-8", errors="ignore")
    m = CANONICAL_RE.search(text[: text.find("</head>")] if "</head>" in text else text)
    if not m or not m.group(1).startswith(SITE):
        return None
    return m.group(1)


def main() -> int:
    urls = sorted({u for u in (canonical_of(a) for a in sys.argv[1:]) if u})
    if not urls:
        print("no indexable page changes; nothing to submit")
        return 0
    body = json.dumps(
        {"host": HOST, "key": KEY, "keyLocation": f"{SITE}/{KEY}.txt", "urlList": urls[:10000]}
    ).encode()
    req = urllib.request.Request(
        "https://api.indexnow.org/indexnow",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"IndexNow: HTTP {resp.status} for {len(urls)} urls")
    except urllib.error.HTTPError as e:  # 4xx/5xx — report, don't fail the build
        print(f"IndexNow: HTTP {e.code} {e.reason} for {len(urls)} urls")
    for u in urls:
        print(" ", u)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
