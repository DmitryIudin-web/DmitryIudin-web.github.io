#!/usr/bin/env python3
"""Generate sitemap-0.xml from the canonical URLs of indexable pages.

A page is included when:
  - it has a <link rel="canonical"> pointing to itself (on https://avtonds.ru),
  - it is not marked noindex.

Run from the repository root:  python3 scripts/generate_sitemap.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://avtonds.ru"

CANONICAL_RE = re.compile(r'<link\s+rel="canonical"\s+href="([^"]+)"')
NOINDEX_RE = re.compile(r'<meta\s+name="robots"[^>]*noindex', re.IGNORECASE)


def page_url(html_path: pathlib.Path) -> str:
    rel = html_path.relative_to(ROOT)
    if rel.name == "index.html":
        path = "/" + str(rel.parent).replace("\\", "/").rstrip(".") + "/"
        path = re.sub("//+", "/", path)
        return SITE + ("/" if path == "/./" else path)
    return SITE + "/" + str(rel).replace("\\", "/")


def main() -> int:
    urls = set()
    for html in sorted(ROOT.rglob("index.html")):
        rel = str(html.relative_to(ROOT))
        if rel.startswith(("frozen-assets/", "_astro/", "assets/", "scripts/", ".git")):
            continue
        text = html.read_text(encoding="utf-8", errors="ignore")
        head = text[: text.find("</head>")] if "</head>" in text else text
        if NOINDEX_RE.search(head):
            continue
        m = CANONICAL_RE.search(head)
        if not m:
            continue
        canonical = m.group(1)
        if not canonical.startswith(SITE):
            continue  # canonical points off-site (e.g. campaign mirrors)
        expected = page_url(html)
        # Include only self-canonical pages; pages canonicalized elsewhere
        # (news brand hubs -> /news/) are represented by their target.
        if canonical.rstrip("/") != expected.rstrip("/"):
            continue
        urls.add(canonical)

    if len(urls) < 10:
        print(f"refusing to write suspiciously small sitemap ({len(urls)} urls)", file=sys.stderr)
        return 1

    entries = "".join(f"<url><loc>{u}</loc></url>" for u in sorted(urls))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml" '
        'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" '
        'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">'
        f"{entries}</urlset>"
    )
    out = ROOT / "sitemap-0.xml"
    out.write_text(xml, encoding="utf-8")
    print(f"wrote {out.name}: {len(urls)} urls")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
