---
name: avtonds-site
description: Работа с репозиторием статического сайта avtonds.ru (DmitryIudin-web.github.io) — правки страниц без порчи CRLF, sitemap, ветки claude/*, PR в main.
version: 1.0.0
author: АСТ
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [avtonds, site, github, seo, tilda]
    related_skills: []
---

# Сайт avtonds.ru — как вносить правки

Репозиторий: `https://github.com/DmitryIudin-web/DmitryIudin-web.github.io`,
локальный клон на сервере: `~/work/avtonds`. Это статический экспорт Tilda/Astro
без сборки; всё, что лежит в корне, публикуется на `https://avtonds.ru/`.

Полные правила — в `AGENTS.md` в корне репозитория. Прочитай его перед первой
правкой. Кратко:

1. **CRLF и минифицированные строки.** Большинство `index.html` — одна очень
   длинная строка с `\r\n`. Правь точечной заменой, читай и пиши файлы в бинарном
   режиме или `open(path, newline='')` в Python. Диф правки одной фразы — 1–3
   строки. Если `git diff --stat` показывает тысячи строк — откати и переделай.
2. **Sitemap не редактировать руками.** `python3 scripts/generate_sitemap.py`
   пересобирает `sitemap-0.xml`; GitHub Actions делает это сам после пуша в main.
3. **Не трогать** `frozen-assets/`, `_astro/`, медиа в `assets/`. Живой рантайм —
   только `assets/ast-conversion.js` и `assets/ast-conversion.css`.
4. **Факты не выдумывать.** Цифры, сроки, гарантии — только те, что уже есть на
   странице или в гайдах сайта.
5. **Секреты в репозиторий не класть**: корень публикуется, `.claude/` исключён
   из деплоя отдельным шагом workflow.

## Порядок работы

```bash
cd ~/work/avtonds
git fetch origin main && git checkout -B claude/<тема> origin/main
# ... правки ...
python3 scripts/generate_sitemap.py
python3 -c "import xml.etree.ElementTree as ET; ET.parse('sitemap-0.xml')"
python3 scripts/sync_agent_docs.py --check
file <изменённая страница>      # должно остаться "with CRLF line terminators"
git add -A && git commit -m "<что и зачем>"
git push -u origin claude/<тема>
```

Дальше открой pull request в `main` (draft) и пришли ссылку Дмитрию. **В `main`
напрямую не пушить** — это запрещено и правилами репозитория, и `approvals.deny`.

## Что где лежит

- `docs/` — служебные документы (не индексируются), `scripts/` — скрипты,
  `tools/` — утилиты. `robots.txt` их закрывает от индексации.
- `kp/` — «КП недели» по моделям; `.claude/skills/kp-avtonds` — внутренний
  расчёт КП со ставками и маржой, его содержимое наружу не выносить.
- Метрика: счётчик `106049767`, цели `ast_*` описаны в `docs/owner-manual-steps.md`.
