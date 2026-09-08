#!/usr/bin/env bash
# =============================================================================
# Hermes Agent — развёртывание на чистом VPS (Ubuntu 22.04 / 24.04, Debian 12).
#
# Что делает (идемпотентно, можно запускать повторно):
#   1. Ставит системные зависимости, фаервол (ufw) и fail2ban.
#   2. Заводит отдельного пользователя `hermes` БЕЗ sudo — агент не получает
#      root и не видит ваш рабочий компьютер.
#   3. Ставит Hermes Agent официальным установщиком (non-interactive).
#   4. Раскладывает шаблоны из этого каталога: SOUL.md, config.yaml, скилл АСТ,
#      .env (из .env.example или из переменных окружения, см. ниже).
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
SSH_PORT="${SSH_PORT:-22}"
WITH_BROWSER="${WITH_BROWSER:-0}"
SITE_REPO="${SITE_REPO:-https://github.com/DmitryIudin-web/DmitryIudin-web.github.io.git}"
INSTALL_URL="https://hermes-agent.nousresearch.com/install.sh"
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$KIT_DIR/hermes-home"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mXX  %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Запускайте от root: sudo bash $0"
[[ -d "$TEMPLATE_DIR" ]] || die "Не найден каталог шаблонов: $TEMPLATE_DIR"
command -v apt-get >/dev/null || die "Скрипт рассчитан на Ubuntu/Debian (apt-get)"

# ---------------------------------------------------------------- 1. система
log "Системные пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates xz-utils ufw fail2ban ffmpeg ripgrep >/dev/null

log "Фаервол: закрыть всё входящее, кроме SSH ($SSH_PORT/tcp)"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow "${SSH_PORT}/tcp" >/dev/null
ufw --force enable >/dev/null
ufw status | sed 's/^/    /'
# Веб-панель Hermes (9119) и API (8642) наружу НЕ открываем: доступ через
# ssh -L 9119:127.0.0.1:9119 <user>@<server>.

systemctl enable --now fail2ban >/dev/null 2>&1 || warn "fail2ban не запустился — проверьте вручную"

# ---------------------------------------------------------- 2. пользователь
if ! id -u "$HERMES_USER" >/dev/null 2>&1; then
  log "Создаю пользователя $HERMES_USER (без sudo)"
  useradd --create-home --shell /bin/bash "$HERMES_USER"
else
  log "Пользователь $HERMES_USER уже есть"
fi
HOME_DIR="$(getent passwd "$HERMES_USER" | cut -d: -f6)"
HERMES_HOME="$HOME_DIR/.hermes"

run_as() { sudo -u "$HERMES_USER" -H env HOME="$HOME_DIR" PATH="$HOME_DIR/.local/bin:$PATH" bash -lc "$*"; }

# ---------------------------------------------------------- 3. Hermes Agent
if [[ "$WITH_BROWSER" == "1" ]]; then
  log "Системные библиотеки для Chromium (Playwright)"
  apt-get install -y -qq nodejs npm >/dev/null || warn "nodejs/npm из apt не поставились"
  npx --yes playwright install-deps chromium >/dev/null 2>&1 || warn "playwright install-deps не отработал"
  BROWSER_FLAG=""
else
  BROWSER_FLAG="--skip-browser"
fi

log "Установка Hermes Agent (официальный установщик, без мастера настройки)"
run_as "curl -fsSL '$INSTALL_URL' | bash -s -- --non-interactive --skip-setup --skip-computer-use $BROWSER_FLAG"
run_as "hermes --version" || die "hermes не запускается после установки"

# --------------------------------------------------------- 4. шаблоны АСТ
log "Раскладываю шаблоны в $HERMES_HOME"
run_as "mkdir -p '$HERMES_HOME/skills' '$HOME_DIR/work'"

install_template() {   # <src> <dst>  — не перезаписывает существующий файл
  local src="$1" dst="$2"
  if [[ -e "$dst" ]]; then
    warn "$dst уже существует — новый шаблон сохранён рядом как $(basename "$dst").ast-template"
    install -o "$HERMES_USER" -g "$HERMES_USER" -m 0644 "$src" "$dst.ast-template"
  else
    install -o "$HERMES_USER" -g "$HERMES_USER" -m 0644 "$src" "$dst"
  fi
}
install_template "$TEMPLATE_DIR/SOUL.md"     "$HERMES_HOME/SOUL.md"
install_template "$TEMPLATE_DIR/config.yaml" "$HERMES_HOME/config.yaml"
cp -r "$TEMPLATE_DIR/skills/." "$HERMES_HOME/skills/"
chown -R "$HERMES_USER:$HERMES_USER" "$HERMES_HOME/skills"

ENV_FILE="$HERMES_HOME/.env"
if [[ ! -e "$ENV_FILE" ]]; then
  install -o "$HERMES_USER" -g "$HERMES_USER" -m 0600 "$TEMPLATE_DIR/.env.example" "$ENV_FILE"
fi
chmod 0600 "$ENV_FILE"

# Дописать в config.yaml значения по умолчанию текущей версии Hermes (наши ключи
# сохраняются). </dev/null — чтобы мастер не ждал ответа "Configure new keys?".
run_as "hermes config migrate </dev/null" >/dev/null 2>&1 || warn "hermes config migrate не отработал — запустите вручную"

# Переменные окружения → .env (только если заданы). Значения на экран не выводятся.
set_env() {   # <KEY> <value>
  local key="$1" val="$2"
  [[ -z "$val" ]] && return 0
  if grep -qE "^#?\s*${key}=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$val" <<'PY'
import re, sys
path, key, val = sys.argv[1:4]
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
           KIMI_API_KEY OPENROUTER_API_KEY ANTHROPIC_API_KEY GROQ_API_KEY GH_TOKEN; do
  set_env "$key" "${!key:-}"
done
# Домашний канал для кронов по умолчанию = личка владельца.
if [[ -n "${TELEGRAM_ALLOWED_USERS:-}" && -z "${TELEGRAM_HOME_CHANNEL:-}" ]]; then
  set_env TELEGRAM_HOME_CHANNEL "${TELEGRAM_ALLOWED_USERS%%,*}"
fi

# ------------------------------------------------------- 5. репозиторий сайта
if [[ ! -d "$HOME_DIR/work/avtonds/.git" ]]; then
  log "Клонирую репозиторий сайта в ~$HERMES_USER/work/avtonds"
  run_as "git clone --quiet '$SITE_REPO' '$HOME_DIR/work/avtonds'"
else
  run_as "git -C '$HOME_DIR/work/avtonds' pull --ff-only --quiet" || warn "git pull не прошёл — проверьте клон"
fi

# ------------------------------------------------------ 6. faster-whisper
log "faster-whisper для голосовых (в venv Hermes)"
VENV_PIP="$HERMES_HOME/hermes-agent/venv/bin/pip"
if [[ -x "$VENV_PIP" ]]; then
  run_as "'$VENV_PIP' install --quiet faster-whisper" || warn "faster-whisper не поставился; можно переключить stt.provider на groq"
else
  warn "venv не найден по пути $VENV_PIP — faster-whisper пропущен"
fi

# -------------------------------------------------------- 7. systemd-сервис
log "Регистрирую шлюз как пользовательский сервис (автозапуск при загрузке)"
loginctl enable-linger "$HERMES_USER" >/dev/null 2>&1 || true
run_as "hermes gateway install" || warn "hermes gateway install завершился с ошибкой — см. вывод выше"

# ------------------------------------------------------------- итог
log "Проверка"
run_as "hermes doctor" | tail -n 25 || true

HAVE_TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=.+' "$ENV_FILE" >/dev/null && echo 1 || echo 0)
HAVE_MODEL=$(grep -qE '^(KIMI_API_KEY|OPENROUTER_API_KEY|ANTHROPIC_API_KEY)=.+' "$ENV_FILE" && echo 1 || echo 0)

cat <<MSG

=============================================================================
 Hermes установлен для пользователя $HERMES_USER. Данные: $HERMES_HOME
=============================================================================
 Дальше — от имени агента:   sudo -iu $HERMES_USER

 1) Модель:        hermes model
      $( [[ $HAVE_MODEL == 1 ]] && echo "ключ уже в .env — просто выберите провайдера и модель" || echo "ключа нет: впишите KIMI_API_KEY/OPENROUTER_API_KEY в ~/.hermes/.env или войдите по подписке ChatGPT/Codex в мастере" )
 2) Telegram:      $( [[ $HAVE_TOKEN == 1 ]] && echo "токен и allowed users уже в .env" || echo "впишите TELEGRAM_BOT_TOKEN и TELEGRAM_ALLOWED_USERS в ~/.hermes/.env (или hermes gateway setup)" )
 3) Запуск:        hermes gateway start && hermes gateway status
 4) Логи:          journalctl --user -u hermes-gateway -f
 5) Веб-панель:    hermes dashboard   (с ноутбука: ssh -L 9119:127.0.0.1:9119 root@СЕРВЕР)

 Проверка после запуска: bash $KIT_DIR/check-vps.sh
=============================================================================
MSG
