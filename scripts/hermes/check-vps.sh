#!/usr/bin/env bash
# Быстрая проверка состояния Hermes на сервере. Ничего не меняет.
# Запуск: bash check-vps.sh   (от root или от пользователя hermes)
set -uo pipefail
HERMES_USER="${HERMES_USER:-hermes}"
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_TOOL="$KIT_DIR/profile.py"
STATUS=0
RUN_EUID="${HERMES_TEST_EUID:-$EUID}"
if [[ $RUN_EUID -eq 0 && "$(id -un)" != "$HERMES_USER" ]]; then
  HOME_DIR="$(getent passwd "$HERMES_USER" | cut -d: -f6)"
  run() { sudo -u "$HERMES_USER" -H env HOME="$HOME_DIR" HERMES_HOME="$HOME_DIR/.hermes" PATH="$HOME_DIR/.local/bin:$PATH" "$@"; }
else
  HOME_DIR="$HOME"; run() { env HERMES_HOME="$HOME_DIR/.hermes" PATH="$HOME_DIR/.local/bin:$PATH" "$@"; }
fi
[[ "$HOME_DIR" == /* && "$HOME_DIR" != / && -d "$HOME_DIR" ]] || { echo 'source_gap: home пользователя Hermes не найден'; exit 1; }
ENV_FILE="$HOME_DIR/.hermes/.env"
hr() { printf '\n--- %s\n' "$*"; }
record() {
  local title="$1"
  shift
  hr "$title"
  if ! "$@"; then
    STATUS=1
    echo "    ОШИБКА"
  fi
}
check_ufw() {
  local output
  output="$(LC_ALL=C ufw status 2>&1)" || return 1
  printf '%s\n' "$output"
  grep -Eq '^Status:[[:space:]]+active([[:space:]]|$)' <<<"$output"
}

record "Версия" run hermes --version
record "Шлюз" run hermes gateway status
hr "Файл секретов"
if [[ -r "$ENV_FILE" ]]; then
  printf '    права: %s\n' "$(stat -c '%a %U' "$ENV_FILE")"
  [[ "$(stat -c '%a' "$ENV_FILE")" == "600" ]] || STATUS=1
else
  echo "    $ENV_FILE не читается"
  STATUS=1
fi
HERMES_PYTHON="$HOME_DIR/.hermes/hermes-agent/venv/bin/python"
HERMES_RUNTIME="$HOME_DIR/.hermes/hermes-agent"
record "Профиль АСТ" run "$HERMES_PYTHON" "$PROFILE_TOOL" check --home "$HOME_DIR/.hermes" --runtime "$HERMES_RUNTIME"
if [[ $RUN_EUID -eq 0 ]]; then
  record "Фаервол" check_ufw
  record "Fail2ban SSH" fail2ban-client status sshd
else
  hr "Фаервол и Fail2ban"
  echo "    source_gap: запустите check-vps.sh от root для системных проверок."
  STATUS=1
fi
record "Открытые порты" ss -tlnp
check_doctor() { run hermes doctor >/dev/null 2>&1; }
record "Doctor" check_doctor

exit "$STATUS"
