#!/usr/bin/env python3
"""Post newly added site pages (news, guides, model landings) to the Telegram channel.

Usage: python3 scripts/telegram_autopost.py <added-file> [<added-file> ...]
Added files are repo-relative paths of *new* HTML pages (git diff --diff-filter=A).

Environment:
  TELEGRAM_BOT_TOKEN  — bot token from @BotFather (repo secret); if unset, the
                        script prints a notice and exits 0 so the build stays green.
  TELEGRAM_CHAT_ID    — channel to post to, default @ASTavtomoto. The bot must be
                        an administrator of the channel.

For each page the post is built from its <title>, meta description and og:image:
photo + caption when an image is available, plain message otherwise.
At most 5 posts per run to avoid flooding the channel.
"""
import json
import os
import pathlib
import re
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://avtonds.ru"
MAX_POSTS = 5

TITLE_RE = re.compile(r"<title>([^<]+)</title>")
DESC_RE = re.compile(r'<meta\s+name="description"\s+content="([^"]*)"')
IMAGE_RE = re.compile(r'<meta\s+property="og:image"\s+content="([^"]*)"')
NOINDEX_RE = re.compile(r'<meta\s+name="robots"[^>]*noindex', re.IGNORECASE)


def html_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def page_info(rel: str) -> dict | None:
    path = ROOT / rel
    if not path.is_file() or path.name != "index.html":
        return None
    parts = pathlib.PurePosixPath(rel).parts
    if parts[0] in ("frozen-assets", "_astro", "assets", "scripts", ".github"):
        return None
    text = path.read_text(encoding="utf-8", errors="ignore")
    head = text[: text.find("</head>")] if "</head>" in text else text
    if NOINDEX_RE.search(head):
        return None
    title = TITLE_RE.search(head)
    if not title:
        return None
    desc = DESC_RE.search(head)
    image = IMAGE_RE.search(head)
    url = SITE + "/" + "/".join(parts[:-1]) + "/"
    return {
        "title": title.group(1).split("|")[0].strip(),
        "desc": (desc.group(1).strip() if desc else ""),
        "image": (image.group(1).strip() if image else ""),
        "url": url,
    }


def tg_call(token: str, method: str, payload: dict) -> tuple[bool, str]:
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return True, f"HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read(200).decode(errors='replace')}"
    except OSError as e:
        return False, str(e)


def main() -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat = os.environ.get("TELEGRAM_CHAT_ID", "@ASTavtomoto").strip()
    pages = [p for p in (page_info(a) for a in sys.argv[1:]) if p]
    if not pages:
        print("no new postable pages")
        return 0
    if not token:
        print(f"TELEGRAM_BOT_TOKEN is not set; skipping {len(pages)} post(s).")
        print("Add the secret in repo Settings → Secrets and variables → Actions.")
        return 0
    for page in pages[:MAX_POSTS]:
        caption = f"<b>{html_escape(page['title'])}</b>"
        if page["desc"]:
            caption += f"\n\n{html_escape(page['desc'])}"
        caption += f"\n\n{page['url']}"
        ok = False
        if page["image"].startswith("http"):
            ok, info = tg_call(token, "sendPhoto", {
                "chat_id": chat, "photo": page["image"],
                "caption": caption[:1024], "parse_mode": "HTML",
            })
            print(f"sendPhoto {page['url']}: {info}")
        if not ok:
            ok, info = tg_call(token, "sendMessage", {
                "chat_id": chat, "text": caption[:4096],
                "parse_mode": "HTML", "disable_web_page_preview": False,
            })
            print(f"sendMessage {page['url']}: {info}")
        time.sleep(3)  # channel rate limit headroom
    skipped = len(pages) - min(len(pages), MAX_POSTS)
    if skipped:
        print(f"skipped {skipped} page(s) over the per-run limit of {MAX_POSTS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
