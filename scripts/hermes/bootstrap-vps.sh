#!/usr/bin/env bash
# =============================================================================
# Hermes Agent — развёртывание на чистом VPS (Ubuntu 22.04 / 24.04, Debian 12).
#
# Что делает (идемпотентно, можно запускать повторно):
#   1. Ставит системные зависимости, фаервол (ufw) и fail2ban.
#   2. Заводит отдельного пользователя `hermes` БЕЗ sudo — агент не получает
#      root и не видит ваш рабочий компьютер.
#   3. Ставит Hermes Agent официальным установщиком (non-interactive).
#   4. Применяет общий профиль АСТ без перезаписи существующих интеграций.
#   5. Клонирует репозиторий сайта в ~hermes/work/avtonds (рабочий каталог агента).
#   6. Ставит faster-whisper для распознавания голосовых.
#   7. Регистрирует шлюз как systemd-сервис пользователя (автозапуск при загрузке).
#
# Запуск (от root, по SSH):
#   export TELEGRAM_BOT_TOKEN='123456:ABC...'      # от @BotFather
#   export TELEGRAM_ALLOWED_USERS='123456789'      # ваш числовой ID (@userinfobot)
#   export KIMI_API_KEY='sk-...'                   # или OPENROUTER_API_KEY / ANTHROPIC_API_KEY
#   bash bootstrap-vps.sh
#
# Переменные можно не задавать — тогда .env создаётся из шаблона, а токены вы
# вписываете потом: `sudo -iu hermes nano ~/.hermes/.env`.
#
# Дополнительно:
#   SSH_PORT=22            порт SSH, который останется открыт в ufw
#   WITH_BROWSER=1         поставить Chromium для браузерных инструментов (нужно ~1 ГБ)
#   HERMES_USER=hermes     имя пользователя-агента
#   SITE_REPO=...          адрес репозитория сайта
# =============================================================================
set -euo pipefail

HERMES_USER="${HERMES_USER:-hermes}"
SSH_PORT_EXPLICIT=0
if [[ ${SSH_PORT+x} ]]; then
  SSH_PORT_EXPLICIT=1
fi
SSH_PORT_INPUT="${SSH_PORT:-}"
WITH_BROWSER="${WITH_BROWSER:-0}"
SITE_REPO="${SITE_REPO:-https://github.com/DmitryIudin-web/DmitryIudin-web.github.io.git}"
HERMES_COMMIT="6e2b8e070d28b1a3381a3fb290b6b8d6cce13cef"
INSTALL_URL="https://raw.githubusercontent.com/NousResearch/hermes-agent/$HERMES_COMMIT/scripts/install.sh"
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$KIT_DIR/hermes-home"
PROFILE_TOOL="$KIT_DIR/profile.py"
HERMES_ETC_DIR="${HERMES_ETC_DIR:-/etc}"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mXX  %s\033[0m\n' "$*" >&2; exit 1; }

normalize_port() {
  local raw="$1" value
  [[ "$raw" =~ ^[0-9]{1,5}$ ]] || die "SSH-порт должен быть десятичным числом от 1 до 65535"
  value=$((10#$raw))
  (( value >= 1 && value <= 65535 )) || die "SSH-порт должен быть числом от 1 до 65535"
  printf '%d' "$value"
}

CONNECTED_SSH_PORT=""
if [[ -n "${SSH_CONNECTION:-}" ]]; then
  read -r _ssh_client _ssh_client_port _ssh_server _ssh_server_port _ssh_extra <<<"$SSH_CONNECTION"
  [[ -n "${_ssh_server_port:-}" && -z "${_ssh_extra:-}" ]] \
    || die "SSH_CONNECTION имеет неожиданный формат; задайте SSH_PORT явно после проверки"
  CONNECTED_SSH_PORT="$(normalize_port "$_ssh_server_port")"
fi
if (( SSH_PORT_EXPLICIT )); then
  SSH_PORT="$(normalize_port "$SSH_PORT_INPUT")"
  if [[ -n "$CONNECTED_SSH_PORT" && "$SSH_PORT" != "$CONNECTED_SSH_PORT" ]]; then
    die "SSH_PORT=$SSH_PORT не совпадает с портом текущего SSH-соединения $CONNECTED_SSH_PORT"
  fi
else
  SSH_PORT="${CONNECTED_SSH_PORT:-22}"
fi

RUN_EUID="${HERMES_TEST_EUID:-$EUID}"
[[ $RUN_EUID -eq 0 ]] || die "Запускайте от root: sudo bash $0"
[[ -d "$TEMPLATE_DIR" ]] || die "Не найден каталог шаблонов: $TEMPLATE_DIR"
[[ -f "$PROFILE_TOOL" ]] || die "Не найден общий инструмент профиля: $PROFILE_TOOL"
command -v apt-get >/dev/null || die "Скрипт рассчитан на Ubuntu/Debian (apt-get)"
[[ "$HERMES_USER" != "root" ]] || die "HERMES_USER не может быть root"
[[ "$HERMES_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || die "Недопустимое имя пользователя Hermes"
if EXISTING_UID="$(id -u "$HERMES_USER" 2>/dev/null)"; then
  [[ "$EXISTING_UID" =~ ^[0-9]+$ ]] || die "Не удалось определить UID пользователя $HERMES_USER"
  (( 10#$EXISTING_UID != 0 )) || die "HERMES_USER указывает на существующего пользователя с UID 0"
  EXISTING_GROUPS="$(id -nG "$HERMES_USER" 2>/dev/null || true)"
  if [[ " $EXISTING_GROUPS " == *" sudo "* || " $EXISTING_GROUPS " == *" wheel "* ]]; then
    die "Пользователь $HERMES_USER входит в sudo/wheel; выберите отдельную непривилегированную учётную запись"
  fi
fi

# ---------------------------------------------------------------- 1. система
log "Системные пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates xz-utils sudo ufw fail2ban python3 python3-systemd ffmpeg ripgrep >/dev/null

log "UFW: deny для нового входящего трафика, SSH $SSH_PORT/tcp; существующие allow-правила сохраняются"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow "${SSH_PORT}/tcp" >/dev/null
ufw --force enable >/dev/null
ufw status | sed 's/^/    /'
# Веб-панель Hermes (9119) и API (8642) наружу НЕ открываем: доступ через
# ssh -L 9119:127.0.0.1:9119 <user>@<server>.

log "Fail2ban: включаю jail для SSH"
install -d -m 0755 "$HERMES_ETC_DIR/fail2ban/jail.d"
install -m 0644 /dev/stdin "$HERMES_ETC_DIR/fail2ban/jail.d/hermes-sshd.local" <<EOF
[sshd]
enabled = true
backend = systemd
port = $SSH_PORT
EOF
systemctl enable --now fail2ban >/dev/null
fail2ban-client reload >/dev/null
fail2ban-client status sshd >/dev/null

# ---------------------------------------------------------- 2. пользователь
if ! id -u "$HERMES_USER" >/dev/null 2>&1; then
  log "Создаю пользователя $HERMES_USER (без sudo)"
  useradd --create-home --shell /bin/bash "$HERMES_USER"
else
  log "Пользователь $HERMES_USER уже есть"
fi
HOME_DIR="$(getent passwd "$HERMES_USER" | cut -d: -f6)"
[[ "$HOME_DIR" == /* && "$HOME_DIR" != / && -d "$HOME_DIR" ]] || die "Не удалось определить домашний каталог Hermes"
HERMES_HOME="$HOME_DIR/.hermes"
HERMES_RUNTIME="$HERMES_HOME/hermes-agent"
HERMES_PYTHON="$HERMES_HOME/hermes-agent/venv/bin/python"
HERMES_UV="$HERMES_HOME/bin/uv"
PROFILE_MODE="new"
if [[ -e "$HERMES_HOME/config.yaml" || -e "$HERMES_HOME/ast-kit.json" || -x "$HERMES_PYTHON" ]]; then
  PROFILE_MODE="existing"
fi

run_as() { sudo -u "$HERMES_USER" -H env HOME="$HOME_DIR" HERMES_HOME="$HERMES_HOME" PATH="$HOME_DIR/.local/bin:$PATH" "$@"; }

# ---------------------------------------------------------- 3. Hermes Agent
if [[ "$WITH_BROWSER" == "1" ]]; then
  log "Системные библиотеки для Chromium (Playwright)"
  apt-get install -y -qq nodejs npm >/dev/null || warn "nodejs/npm из apt не поставились"
  npx --yes playwright install-deps chromium >/dev/null 2>&1 || warn "playwright install-deps не отработал"
  BROWSER_FLAGS=()
else
  BROWSER_FLAGS=(--skip-browser)
fi

log "Установка Hermes Agent из проверенного commit $HERMES_COMMIT"
if [[ -x "$HERMES_PYTHON" ]]; then
  log "Существующий runtime найден — переустановка пропущена"
else
  INSTALLER_FILE="$(mktemp)"
  trap 'rm -f "$INSTALLER_FILE"' EXIT
  curl -fsSL "$INSTALL_URL" -o "$INSTALLER_FILE"
  chmod 0755 "$INSTALLER_FILE"
  run_as bash "$INSTALLER_FILE" --non-interactive --skip-setup --skip-computer-use "${BROWSER_FLAGS[@]}" --commit "$HERMES_COMMIT"
fi
run_as hermes --version || die "hermes не запускается после установки"

# --------------------------------------------------------- 4. секреты
run_as mkdir -p "$HOME_DIR/work"

ENV_FILE="$HERMES_HOME/.env"
[[ ! -L "$HERMES_HOME" && ! -L "$ENV_FILE" ]] || die "Приватный профиль и .env не должны быть символическими ссылками"
if [[ ! -e "$ENV_FILE" ]]; then
  install -o "$HERMES_USER" -g "$HERMES_USER" -m 0600 "$TEMPLATE_DIR/.env.example" "$ENV_FILE"
fi
chmod 0600 "$ENV_FILE"

# Переменные окружения → .env (только если заданы). Значения на экран не выводятся.
set_env() {   # <KEY> <value>
  local key="$1" val="$2"
  [[ -z "$val" ]] && return 0
  if grep -qE "^#?\s*${key}=" "$ENV_FILE"; then
    HERMES_SET_ENV_VALUE="$val" python3 - "$ENV_FILE" "$key" <<'PY'
import os, re, sys
path, key = sys.argv[1:3]
val = os.environ.pop("HERMES_SET_ENV_VALUE")
lines = open(path, encoding="utf-8").read().splitlines()
pat = re.compile(r"^#?\s*" + re.escape(key) + r"=")
out = [f"{key}={val}" if pat.match(l) else l for l in lines]
open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")
PY
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
  echo "    $key — записан"
}
log "Секреты из окружения → .env"
for key in TELEGRAM_BOT_TOKEN TELEGRAM_ALLOWED_USERS TELEGRAM_HOME_CHANNEL \
           KIMI_API_KEY OPENROUTER_API_KEY ANTHROPIC_API_KEY GROQ_API_KEY; do
  set_env "$key" "${!key:-}"
done
# Домашний канал для кронов по умолчанию = личка владельца.
if [[ -n "${TELEGRAM_ALLOWED_USERS:-}" && -z "${TELEGRAM_HOME_CHANNEL:-}" ]]; then
  set_env TELEGRAM_HOME_CHANNEL "${TELEGRAM_ALLOWED_USERS%%,*}"
fi

# ------------------------------------------------------- 5. репозиторий сайта
if [[ ! -d "$HOME_DIR/work/avtonds/.git" ]]; then
  log "Клонирую репозиторий сайта в ~$HERMES_USER/work/avtonds"
  run_as git clone --quiet -- "$SITE_REPO" "$HOME_DIR/work/avtonds"
else
  log "Рабочая копия сайта уже есть — её ветка и незакоммиченные изменения сохранены"
fi

# ------------------------------------------------------- 6. общий профиль
log "Применяю общий профиль АСТ ($PROFILE_MODE)"
[[ -x "$HERMES_PYTHON" ]] || die "Не найден Python Hermes: $HERMES_PYTHON"
run_as "$HERMES_PYTHON" "$PROFILE_TOOL" apply --home "$HERMES_HOME" --workspace "$HOME_DIR/work/avtonds" --mode "$PROFILE_MODE"
run_as "$HERMES_PYTHON" "$PROFILE_TOOL" check --home "$HERMES_HOME" --runtime "$HERMES_RUNTIME"

# ------------------------------------------------------ 7. faster-whisper
log "faster-whisper для голосовых (в venv Hermes)"
[[ -x "$HERMES_UV" ]] || die "Не найден управляемый uv Hermes: $HERMES_UV"
run_as "$HERMES_UV" pip install --quiet --python "$HERMES_PYTHON" 'faster-whisper==1.2.1'
run_as "$HERMES_PYTHON" -c 'import faster_whisper'

# -------------------------------------------------------- 8. systemd-сервис
log "Регистрирую шлюз как пользовательский сервис (автозапуск при загрузке)"
loginctl enable-linger "$HERMES_USER" >/dev/null
run_as hermes gateway install --no-start-now --start-on-login

# ------------------------------------------------------------- итог
log "Проверка"
run_as hermes doctor >/dev/null 2>&1 || die "hermes doctor не прошёл; проверьте локально без публикации журналов"

HAVE_TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=.+' "$ENV_FILE" >/dev/null && echo 1 || echo 0)
HAVE_MODEL=$(grep -qE '^(KIMI_API_KEY|OPENROUTER_API_KEY|ANTHROPIC_API_KEY)=.+' "$ENV_FILE" && echo 1 || echo 0)

cat <<MSG

=============================================================================
 Hermes установлен для пользователя $HERMES_USER. Данные: $HERMES_HOME
=============================================================================
 Дальше — от имени агента:   sudo -iu $HERMES_USER

 1) Модель:        hermes model
      $( [[ $HAVE_MODEL == 1 ]] && echo "ключ уже в .env — выберите провайдера и модель" || echo "настройте выбранного провайдера через мастер hermes model" )
 2) Telegram:      $( [[ $HAVE_TOKEN == 1 ]] && echo "токен и allowed users уже в .env" || echo "впишите TELEGRAM_BOT_TOKEN и TELEGRAM_ALLOWED_USERS в ~/.hermes/.env (или hermes gateway setup)" )
 3) Запуск:        hermes gateway start && hermes gateway status
 4) Логи:          journalctl --user -u hermes-gateway -f
 5) Веб-панель:    hermes dashboard   (с ноутбука: ssh -L 9119:127.0.0.1:9119 root@СЕРВЕР)

 Проверка после запуска: bash $KIT_DIR/check-vps.sh
=============================================================================
MSG
