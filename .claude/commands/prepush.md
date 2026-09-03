---
description: Полный чек-лист перед push (sitemap, XML, синхронизация доков, CRLF)
allowed-tools: Bash(python3 scripts/*), Bash(python3 -c *), Bash(git *), Bash(file *)
---
Прогони чек-лист перед push из CLAUDE.md и отчитайся по каждому пункту явно
(пройдено / не пройдено, с выводом команды):

1. `python3 scripts/generate_sitemap.py` — без ошибок, ~57 URL.
2. `python3 -c "import xml.etree.ElementTree as ET; ET.parse('sitemap-0.xml')"`.
3. `python3 scripts/sync_agent_docs.py --check` — AGENTS.md совпадает с CLAUDE.md.
4. CRLF изменённых страниц сохранён (`file` показывает «with CRLF line terminators»).
5. `git status` — в индексе нет `frozen-assets/`, `_astro/`, `assets/`.
6. Ветка — `claude/*` или `codex/*`, не `main`.

Любой непройденный пункт — почини до push, а не описывай.
