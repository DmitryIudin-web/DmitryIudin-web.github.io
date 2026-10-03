# Настройка агентов в VS Code (Этап 2)

Цель: работа над сайтом не останавливается, когда кончается лимит у Claude Code
или Codex. Порядок переключения и правила — в `docs/agents-playbook.md`.

> `docs/` публикуется на сайте (закрыт только в robots.txt). Ключи API,
> пароли и внутреннюю экономику сюда не писать.

Названия моделей меняются каждые пару месяцев — берите актуальные версии
у провайдера (рейтинг: https://openrouter.ai/collections/programming).
Данные ниже проверены на 2026-09.

## Шаг 0. Репозиторий (на каждой машине, один раз)

Команды выполнять **в папке репозитория** (в VS Code: Terminal → New Terminal
при открытой папке проекта), а не в домашней папке.

Windows (PowerShell):

```powershell
git checkout main; git pull
python scripts/install_hooks.py   # pre-commit хук + ignore-файлы агентов
python scripts/check.py           # должно быть «ИТОГ: OK»
```

macOS / Linux: те же команды с `python3`.

Если `python` не найден — установить Python 3.9+ с python.org с галочкой
«Add python.exe to PATH» (заглушка из Microsoft Store не подходит).
Хук сам ищет `python3`, `python` и `py -3`.

## Шаг 1. Основные агенты

- Расширения VS Code **Claude Code** (Anthropic) и **Codex** (OpenAI),
  вход в свои подписки.
- Проверка: попросить каждого «найди правило про CRLF» — оба должны сослаться
  на `CLAUDE.md` / `AGENTS.md`.

## Шаг 2. Запасной агент: Cline + OpenRouter

1. openrouter.ai → пополнить баланс (карта или криптовалюта) → создать API-ключ
   с **лимитом расходов** (например, $20/мес).
2. Расширение **Cline** (аналоги: Roo Code, Kilo Code). Провайдер — OpenRouter,
   ключ из п. 1.
3. Профили моделей:

   | Профиль | Модель (пример на 2026-09) | Для чего |
   |---|---|---|
   | основной запас | Kimi (K3 / K2.x) | обычные правки страниц и текстов |
   | второй вариант | Qwen3-Coder | если Kimi недоступен или ошибается |
   | дешёвый | DeepSeek V4 Flash | рутина: опечатки, мелкие замены |

4. В настройках Cline **выключить автоодобрение** правок и команд.
5. `.clineignore` / `.rooignore` / `.kilocodeignore` уже в репозитории — скилл
   КП и замороженные бандлы агент не видит.

## Шаг 3. Claude Code на другой модели (по желанию)

Когда кончился лимит Claude, можно остаться в Claude Code (скиллы, `/prepush`,
хуки работают), подменив модель через Anthropic-совместимый эндпоинт:

```bash
# ~/.bashrc или ~/.zshrc — ключи только здесь или в менеджере паролей
alias claude-kimi='ANTHROPIC_BASE_URL=https://api.moonshot.ai/anthropic ANTHROPIC_AUTH_TOKEN="$MOONSHOT_API_KEY" claude'
alias claude-ds='ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic ANTHROPIC_AUTH_TOKEN="$DEEPSEEK_API_KEY" claude'
```

Документация: https://platform.kimi.ai/docs/guide/claude-code-kimi,
https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code/

**В этом режиме не запускать `/kp-avtonds`** — внутренние ставки уйдут провайдеру.

## Шаг 4. Третий независимый лимит (по желанию)

- **GitHub Copilot** (agent mode): отдельная подписка, внутри Claude и GPT.
  Плюс — ревью PR, когда кончился лимит ревью Codex.

## Шаг 5. Проверить доступ заранее

- [ ] Каждый сервис открывается и оплачивается из РФ (включая пополнение OpenRouter).
- [ ] Ключи сохранены в менеджере паролей, не в репозитории.

## Готово, если

Одна и та же мелкая задача («поправь фразу на странице X») выполнена через
Cline+Kimi и Cline+DeepSeek, и после каждой:

```bash
git diff --stat            # 1–3 строки на страницу
python3 scripts/check.py   # ИТОГ: OK
```

Модели, которые ломают CRLF или переписывают страницу целиком, — убрать
из профилей (см. «Журнал моделей» в `docs/agents-playbook.md`).
