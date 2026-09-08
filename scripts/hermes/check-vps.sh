#!/usr/bin/env bash
# Быстрая проверка состояния Hermes на сервере. Ничего не меняет.
# Запуск: bash check-vps.sh   (от root или от пользователя hermes)
set -uo pipefail
HERMES_USER="${HERMES_USER:-hermes}"
if [[ $EUID -eq 0 && "$(id -un)" != "$HERMES_USER" ]]; then
  HOME_DIR="$(getent passwd "$HERMES_USER" | cut -d: -f6)"
  run() { sudo -u "$HERMES_USER" -H env HOME="$HOME_DIR" PATH="$HOME_DIR/.local/bin:$PATH" bash -lc "$*"; }
else
  HOME_DIR="$HOME"; run() { bash -lc "$*"; }
fi
ENV_FILE="$HOME_DIR/.hermes/.env"
hr() { printf '\n--- %s\n' "$*"; }

hr "Версия";            run "hermes --version" 2>&1 | tail -n 3
hr "Шлюз";              run "hermes gateway status" 2>&1 | tail -n 15
hr "Секреты в .env (только имена заполненных ключей)"
if [[ -r "$ENV_FILE" ]]; then
  grep -E '^[A-Z_]+=.+' "$ENV_FILE" | cut -d= -f1 | sed 's/^/    /'
  printf '    права: %s\n' "$(stat -c '%a %U' "$ENV_FILE")"
else
  echo "    $ENV_FILE не читается"
fi
hr "Модель";            run "hermes config get model.provider; hermes config get model.default" 2>&1 | tail -n 4
hr "Кроны";             run "hermes cron list" 2>&1 | tail -n 20
hr "Фаервол";           (command -v ufw >/dev/null && ufw status 2>/dev/null | head -n 12) || echo "    ufw не установлен"
hr "Открытые порты";    ss -tlnp 2>/dev/null | awk 'NR==1 || /LISTEN/' | head -n 15
hr "Последние строки журнала шлюза"
run "journalctl --user -u hermes-gateway -n 20 --no-pager" 2>&1 | tail -n 20
hr "Doctor";            run "hermes doctor" 2>&1 | tail -n 15
