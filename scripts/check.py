#!/usr/bin/env python3
"""Единая проверка правок для любого агента (Claude Code, Codex, Cline, Kimi, Qwen...).

Заменяет чек-лист /prepush вне Claude Code и запускается в трёх местах:

    python3 scripts/check.py              # вручную: ветка против main + незакоммиченное
    python3 scripts/check.py --staged     # git pre-commit хук (scripts/install_hooks.py)

В Windows вместо python3 — python или py -3.
    python3 scripts/check.py --base origin/main   # CI на PR (.github/workflows/pr-checks.yml)

Что проверяет (правила из CLAUDE.md):
  1. Замороженные пути не тронуты: frozen-assets/, _astro/; в assets/ нельзя
     менять/удалять существующее (новые файлы можно; ast-conversion.js|css
     правятся штатно).                                      [--allow-frozen]
  2. Файлы, которые были CRLF, остались CRLF (нет «голых» LF).
  3. HTML-страница не переписана целиком (диф почти во все строки
     или число строк изменилось в разы).                    [--allow-rewrite]
  4. У правленой страницы не пропал canonical и не появился noindex.
  5. sitemap-0.xml — валидный XML; если он изменён, набор URL совпадает с тем,
     что строит scripts/generate_sitemap.py (т.е. не правлен руками).
  6. AGENTS.md совпадает с CLAUDE.md.
  7. Инварианты: шаг исключения .claude/ в deploy-pages.yml,
     Clean-param в robots.txt, ignore-файлы агентов закрывают kp-avtonds.
  8. Коммит/проверка идут не на ветке main (только локально).

Код выхода 0 — всё чисто, 1 — есть ошибки. Файлы читаются в бинарном режиме.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FROZEN_PREFIXES = ("frozen-assets/", "_astro/", "assets/")
FROZEN_ALLOWED = {"assets/ast-conversion.js", "assets/ast-conversion.css"}
TEXT_EXT = {".html", ".htm", ".xml", ".txt", ".css", ".js", ".mjs", ".json",
            ".md", ".py", ".sh", ".yml", ".yaml", ".svg"}
AGENT_IGNORE_FILES = (".aiderignore", ".clineignore", ".rooignore",
                      ".kilocodeignore", ".cursorignore", ".codeiumignore",
                      ".geminiignore", ".continueignore")
SECRET_PATH = ".claude/skills/kp-avtonds"

# Порог «переписан целиком»: файл от MIN_LINES строк, в дифе удалено больше
# REWRITE_SHARE его строк, либо число строк изменилось более чем в LINES_FACTOR раз.
MIN_LINES = 20
REWRITE_SHARE = 0.5
LINES_FACTOR = 2.0

CANONICAL_RE = re.compile(rb'<link\s+rel="canonical"\s+href="([^"]+)"')
NOINDEX_RE = re.compile(rb'<meta\s+name="robots"[^>]*noindex', re.IGNORECASE)


def git(*args: str, check: bool = True) -> bytes:
    res = subprocess.run(["git", *args], cwd=ROOT, capture_output=True)
    if check and res.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {res.stderr.decode(errors='replace').strip()}")
    return res.stdout


class Target:
    """Откуда брать «старую» и «новую» версию файла."""

    def __init__(self, staged: bool, base: str | None):
        self.staged = staged
        if staged:
            has_head = subprocess.run(["git", "rev-parse", "--verify", "-q", "HEAD"],
                                      cwd=ROOT, capture_output=True).returncode == 0
            self.base = "HEAD" if has_head else None
        else:
            ref = base or self._default_base()
            self.base = git("merge-base", ref, "HEAD").decode().strip() if ref else None

    @staticmethod
    def _default_base() -> str | None:
        for ref in ("origin/main", "main"):
            if subprocess.run(["git", "rev-parse", "--verify", "-q", ref],
                              cwd=ROOT, capture_output=True).returncode == 0:
                return ref
        return None

    def changes(self) -> list[tuple[str, str]]:
        """[(статус A/M/D/R, путь)] для всех изменений относительно базы."""
        if self.staged:
            args = ["diff", "--cached", "--name-status", "--no-renames", "-z"]
        else:
            args = ["diff", "--name-status", "--no-renames", "-z"]
        if self.base:
            args.append(self.base)
        elif not self.staged:
            return [("A", p) for p in git("ls-files", "-z").decode().split("\0") if p]
        parts = git(*args).decode().split("\0")
        out = [(parts[i][0], parts[i + 1]) for i in range(0, len(parts) - 1, 2) if parts[i]]
        if not self.staged:
            untracked = git("ls-files", "--others", "--exclude-standard", "-z").decode()
            out += [("A", p) for p in untracked.split("\0") if p]
        return out

    def old(self, path: str) -> bytes | None:
        if not self.base:
            return None
        res = subprocess.run(["git", "show", f"{self.base}:{path}"], cwd=ROOT, capture_output=True)
        return res.stdout if res.returncode == 0 else None

    def new(self, path: str) -> bytes | None:
        if self.staged:
            res = subprocess.run(["git", "show", f":{path}"], cwd=ROOT, capture_output=True)
            return res.stdout if res.returncode == 0 else None
        p = ROOT / path
        return p.read_bytes() if p.is_file() else None


def bare_lf(data: bytes) -> int:
    return data.count(b"\n") - data.count(b"\r\n")


def check_frozen(changes, allow: bool, errors, warnings):
    for status, path in changes:
        if not path.startswith(FROZEN_PREFIXES) or path in FROZEN_ALLOWED:
            continue
        # Новые картинки в assets/ добавлять можно; существующие медиа — нет.
        if path.startswith("assets/") and status == "A":
            continue
        msg = f"[frozen] {status} {path}: замороженный путь (CLAUDE.md, правило 3)"
        (warnings if allow else errors).append(msg)


def check_structure(t: Target, changes, allow_rewrite: bool, errors, warnings):
    for status, path in changes:
        if status != "M" or Path(path).suffix.lower() not in TEXT_EXT:
            continue
        old, new = t.old(path), t.new(path)
        if old is None or new is None:
            continue

        # CRLF: файл был целиком CRLF — «голых» LF появиться не должно.
        if b"\r\n" in old and bare_lf(old) == 0 and bare_lf(new) > 0:
            errors.append(
                f"[crlf] {path}: файл был CRLF, теперь {bare_lf(new)} строк с LF. "
                "Откатите (git checkout -- путь) и правьте точечно, с newline=''."
            )

        # Страница переписана целиком? (документы и скрипты править крупно можно)
        old_lines, new_lines = old.count(b"\n") + 1, new.count(b"\n") + 1
        if path.endswith(".html") and max(old_lines, new_lines) >= MIN_LINES:
            deleted = 0
            if t.base:
                spec = ["diff", "--numstat"] + (["--cached"] if t.staged else []) + [t.base, "--", path]
                row = git(*spec).decode().split("\t")
                deleted = int(row[1]) if len(row) > 1 and row[1].isdigit() else 0
            ratio = max(old_lines, new_lines) / max(1, min(old_lines, new_lines))
            if deleted > REWRITE_SHARE * old_lines or ratio > LINES_FACTOR:
                msg = (f"[rewrite] {path}: удалено {deleted} из {old_lines} строк, "
                       f"строк стало {new_lines} — похоже, файл переписан целиком "
                       "(CLAUDE.md, правило 1)")
                (warnings if allow_rewrite else errors).append(msg)

        # SEO-инварианты страниц.
        if path.endswith(".html"):
            old_head, new_head = old.split(b"</head>")[0], new.split(b"</head>")[0]
            if CANONICAL_RE.search(old_head) and not CANONICAL_RE.search(new_head):
                errors.append(f"[seo] {path}: пропал <link rel=\"canonical\">")
            if not NOINDEX_RE.search(old_head) and NOINDEX_RE.search(new_head):
                errors.append(f"[seo] {path}: появился noindex — страница выпадет из индекса")


def check_sitemap(t: Target, changes, errors):
    data = t.new("sitemap-0.xml")
    if data is None:
        errors.append("[sitemap] sitemap-0.xml отсутствует")
        return
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        errors.append(f"[sitemap] sitemap-0.xml — невалидный XML: {e}")
        return
    if not any(p == "sitemap-0.xml" for _, p in changes):
        return
    sys.path.insert(0, str(ROOT / "scripts"))
    import generate_sitemap  # noqa: E402

    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    have = {el.text for el in root.iter(f"{ns}loc")}
    want = set(generate_sitemap.collect_urls(lastmod=lambda _p: ""))
    if have != want:
        extra, missing = sorted(have - want)[:5], sorted(want - have)[:5]
        errors.append(
            "[sitemap] sitemap-0.xml не совпадает с генератором (правлен руками?). "
            f"Лишние: {extra or '—'}; нет: {missing or '—'}. "
            "Запустите: python3 scripts/generate_sitemap.py"
        )


def check_invariants(t: Target, errors):
    claude, agents = t.new("CLAUDE.md"), t.new("AGENTS.md")
    if claude != agents:
        errors.append("[docs] AGENTS.md не совпадает с CLAUDE.md — правьте CLAUDE.md, "
                      "затем: python3 scripts/sync_agent_docs.py")

    deploy = t.new(".github/workflows/deploy-pages.yml") or b""
    if not re.search(rb"rm -rf[^\n]*\.claude", deploy):
        errors.append("[deploy] из deploy-pages.yml пропал шаг исключения .claude/ "
                      "(CLAUDE.md, правило 6)")

    robots = t.new("robots.txt") or b""
    if b"Clean-param: quoteId /offers" not in robots:
        errors.append("[robots] из robots.txt пропал Clean-param: quoteId /offers")

    for name in AGENT_IGNORE_FILES:
        data = t.new(name)
        if data is None or SECRET_PATH.encode() not in data:
            errors.append(f"[ignore] {name} отсутствует или не закрывает {SECRET_PATH}/")


def check_branch(t: Target, errors):
    if os.environ.get("GITHUB_ACTIONS"):
        return
    branch = git("rev-parse", "--abbrev-ref", "HEAD", check=False).decode().strip()
    if branch == "main":
        errors.append("[branch] вы на main — работайте в ветке <агент>/<задача> "
                      "(claude/*, codex/*, cline/* ...) и мержите через PR")


def main() -> int:
    # Консоль Windows (cp866/cp1251) не должна ронять проверку на «—» и «».
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--staged", action="store_true", help="проверять индекс против HEAD (pre-commit)")
    ap.add_argument("--base", help="база сравнения (по умолчанию merge-base с origin/main)")
    ap.add_argument("--allow-frozen", action="store_true", help="разрешить правку замороженных путей")
    ap.add_argument("--allow-rewrite", action="store_true", help="разрешить крупную переделку файлов")
    args = ap.parse_args()

    try:
        t = Target(args.staged, args.base)
    except RuntimeError as e:
        print(f"check.py: не удалось определить базу сравнения: {e}", file=sys.stderr)
        return 2
    changes = t.changes()
    errors: list[str] = []
    warnings: list[str] = []

    check_frozen(changes, args.allow_frozen, errors, warnings)
    check_structure(t, changes, args.allow_rewrite, errors, warnings)
    check_sitemap(t, changes, errors)
    check_invariants(t, errors)
    check_branch(t, errors)

    mode = "индекс против HEAD" if args.staged else f"против {(t.base or 'пустой базы')[:12]}"
    print(f"check.py: {len(changes)} изменённых файлов ({mode})")
    for w in warnings:
        print(f"  ПРЕДУПРЕЖДЕНИЕ {w}")
    for e in errors:
        print(f"  ОШИБКА {e}")
    if errors:
        print(f"ИТОГ: {len(errors)} ошибок. Почините до коммита/push. "
              "Обход (осознанно): --allow-frozen / --allow-rewrite, в PR — метки allow-frozen / allow-rewrite.")
        return 1
    print("ИТОГ: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
