---
description: Пересобрать sitemap-0.xml и проверить, что XML валиден
allowed-tools: Bash(python3 scripts/generate_sitemap.py), Bash(python3 -c *), Bash(git diff *)
---
Пересобери карту сайта и проверь результат:

1. `python3 scripts/generate_sitemap.py` — должен завершиться без ошибок (~57 URL).
2. `python3 -c "import xml.etree.ElementTree as ET; ET.parse('sitemap-0.xml')"`.
3. `git diff --stat sitemap-0.xml` — покажи, что изменилось.

`sitemap-0.xml` руками не правь — только через генератор.
