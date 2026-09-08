#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BOOTSTRAP="$ROOT/scripts/hermes/bootstrap-vps.sh"
CHECK="$ROOT/scripts/hermes/check-vps.sh"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local file="$1" text="$2"
  grep -Fq -- "$text" "$file" || fail "$(basename "$file") must contain: $text"
}

assert_not_contains() {
  local file="$1" text="$2"
  if grep -Fq -- "$text" "$file"; then
    fail "$(basename "$file") must not contain: $text"
  fi
}

bash -n "$BOOTSTRAP"
bash -n "$CHECK"

# The Debian 12 minimal image does not guarantee sudo, while both scripts use it.
assert_contains "$BOOTSTRAP" "sudo"
assert_contains "$BOOTSTRAP" "apt-get install"

# The reviewed upstream source and its installer must move together.
assert_contains "$BOOTSTRAP" 'HERMES_COMMIT="6e2b8e070d28b1a3381a3fb290b6b8d6cce13cef"'
assert_contains "$BOOTSTRAP" 'raw.githubusercontent.com/NousResearch/hermes-agent/$HERMES_COMMIT/scripts/install.sh'
assert_contains "$BOOTSTRAP" '--commit "$HERMES_COMMIT"'
assert_not_contains "$BOOTSTRAP" 'hermes-agent.nousresearch.com/install.sh'

# Fresh and repeated runs both go through the shared profile owner.
assert_contains "$BOOTSTRAP" 'PROFILE_MODE="new"'
assert_contains "$BOOTSTRAP" 'PROFILE_MODE="existing"'
assert_contains "$BOOTSTRAP" '"$PROFILE_TOOL" apply'
assert_contains "$BOOTSTRAP" '"$PROFILE_TOOL" check'
assert_contains "$BOOTSTRAP" 'HERMES_ETC_DIR'
assert_contains "$BOOTSTRAP" '--runtime'
assert_contains "$BOOTSTRAP" 'SSH_CONNECTION'
assert_contains "$BOOTSTRAP" '10#'
assert_contains "$BOOTSTRAP" 'HERMES_USER не может быть root'
assert_contains "$BOOTSTRAP" 'id -nG'

# Reapplying the kit must not erase unrelated firewall rules.
assert_not_contains "$BOOTSTRAP" 'ufw --force reset'
assert_contains "$BOOTSTRAP" 'fail2ban/jail.d/hermes-sshd.local'
assert_contains "$BOOTSTRAP" 'backend = systemd'
assert_contains "$BOOTSTRAP" 'fail2ban-client status sshd'
assert_contains "$BOOTSTRAP" 'gateway install --no-start-now --start-on-login'

# Use the managed uv environment and the reviewed voice dependency pin.
assert_contains "$BOOTSTRAP" 'HERMES_UV="$HERMES_HOME/bin/uv"'
assert_contains "$BOOTSTRAP" 'pip install'
assert_contains "$BOOTSTRAP" 'faster-whisper==1.2.1'
assert_not_contains "$BOOTSTRAP" 'venv/bin/pip'

# The agent receives no repository publishing credential from the bootstrap.
assert_not_contains "$BOOTSTRAP" 'GH_TOKEN'

# Health checks report effective policy and service state without dumping logs.
assert_contains "$CHECK" '"$PROFILE_TOOL" check'
assert_contains "$CHECK" '--runtime'
assert_contains "$CHECK" 'fail2ban-client status sshd'
assert_not_contains "$CHECK" 'journalctl'
assert_contains "$CHECK" 'hermes doctor >/dev/null 2>&1'
assert_contains "$CHECK" '^Status:[[:space:]]+active'
assert_contains "$CHECK" 'source_gap'

# Run the orchestration against isolated command stubs. No package, firewall,
# service, network, or real Hermes state is touched.
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
mkdir -p "$SANDBOX/kit/hermes-home" "$SANDBOX/bin" "$SANDBOX/etc/fail2ban/jail.d" "$SANDBOX/home"
cp "$BOOTSTRAP" "$SANDBOX/kit/bootstrap-vps.sh"
touch "$SANDBOX/kit/profile.py"

make_stub() {
  local name="$1"
  shift
  printf '#!/usr/bin/env bash\n%s\n' "$*" > "$SANDBOX/bin/$name"
  chmod +x "$SANDBOX/bin/$name"
}

make_stub apt-get 'printf "apt-get %s\n" "$*" >> "$HERMES_TEST_SANDBOX/system.log"; exit 0'
make_stub ufw 'printf "ufw %s\n" "$*" >> "$HERMES_TEST_SANDBOX/system.log"; printf "Status: %s\n" "${HERMES_TEST_UFW_STATUS:-active}"; exit 0'
make_stub systemctl 'exit 0'
make_stub fail2ban-client 'exit 0'
make_stub loginctl 'exit 0'
make_stub npx 'exit 0'
make_stub ss 'exit 0'
make_stub id 'if [[ "${1:-}" == "-u" ]]; then echo "${HERMES_TEST_EXISTING_UID:-1000}"; exit 0; fi; if [[ "${1:-}" == "-un" ]]; then echo root; exit 0; fi; if [[ "${1:-}" == "-nG" ]]; then echo "${HERMES_TEST_GROUPS:-hermes}"; exit 0; fi; exec /usr/bin/id "$@"'
make_stub getent 'printf "hermes:x:1000:1000::%s/home:/bin/bash\n" "$HERMES_TEST_SANDBOX"'
make_stub sudo 'while (($#)); do case "$1" in -u) shift 2;; -H) shift;; *) break;; esac; done; exec "$@"'
make_stub git 'if [[ "${1:-}" == "clone" || "${2:-}" == "clone" ]]; then target="${@: -1}"; mkdir -p "$target/.git"; fi; exit 0'
make_stub uv 'printf "uv %s\n" "$*" >> "$HERMES_TEST_SANDBOX/calls.log"; exit 0'
make_stub python3 'printf "python3 %s\n" "$*" >> "$HERMES_TEST_SANDBOX/argv.log"; exec /usr/bin/python3 "$@"'
make_stub curl 'out=""; while (($#)); do if [[ "$1" == "-o" ]]; then out="$2"; shift 2; else shift; fi; done; cp "$HERMES_TEST_SANDBOX/fake-installer.sh" "$out"'

cat > "$SANDBOX/fake-installer.sh" <<'EOF'
#!/usr/bin/env bash
printf 'installer %s\n' "$*" >> "$HERMES_TEST_SANDBOX/calls.log"
mkdir -p "$HOME/.hermes/hermes-agent/venv/bin" "$HOME/.hermes/bin" "$HOME/.local/bin"
touch "$HOME/.hermes/config.yaml" "$HOME/.hermes/SOUL.md"
printf 'TELEGRAM_BOT_TOKEN=\n' > "$HOME/.hermes/.env"
chmod 600 "$HOME/.hermes/.env"
cat > "$HOME/.hermes/hermes-agent/venv/bin/python" <<'PY'
#!/usr/bin/env bash
printf 'runtime-python %s\n' "$*" >> "$HERMES_TEST_SANDBOX/calls.log"
if [[ " $* " == *"/profile.py check "* && "${HERMES_TEST_POLICY_FAIL:-0}" == 1 ]]; then exit 9; fi
exit 0
PY
cat > "$HOME/.local/bin/hermes" <<'HERMES'
#!/usr/bin/env bash
exit 0
HERMES
cat > "$HOME/.hermes/bin/uv" <<'UV'
#!/usr/bin/env bash
printf 'managed-uv %s\n' "$*" >> "$HERMES_TEST_SANDBOX/calls.log"
exit 0
UV
chmod +x "$HOME/.hermes/hermes-agent/venv/bin/python" "$HOME/.hermes/bin/uv" "$HOME/.local/bin/hermes"
EOF
chmod +x "$SANDBOX/fake-installer.sh"

run_bootstrap() {
  env PATH="$SANDBOX/bin:$PATH" HERMES_TEST_SANDBOX="$SANDBOX" \
    HERMES_TEST_EUID=0 HERMES_ETC_DIR="$SANDBOX/etc" HERMES_USER=hermes SSH_PORT=2222 \
    HERMES_TEST_POLICY_FAIL="${HERMES_TEST_POLICY_FAIL:-0}" \
    TELEGRAM_BOT_TOKEN='secret-must-not-be-an-argv' \
    bash "$SANDBOX/kit/bootstrap-vps.sh" >/dev/null
}

run_bootstrap
[[ "$(grep -c '^installer ' "$SANDBOX/calls.log")" == 1 ]] || fail "fresh run must install exactly once"
[[ -f "$SANDBOX/etc/fail2ban/jail.d/hermes-sshd.local" ]] || fail "fail2ban sshd jail was not installed"
grep -Fq 'backend = systemd' "$SANDBOX/etc/fail2ban/jail.d/hermes-sshd.local" || fail "fail2ban systemd backend missing"
grep -Fq -- '--commit 6e2b8e070d28b1a3381a3fb290b6b8d6cce13cef' "$SANDBOX/calls.log" || fail "installer commit pin missing"
grep -Fq -- 'profile.py apply' "$SANDBOX/calls.log" || fail "profile apply was not called"
grep -Fq -- '--mode new' "$SANDBOX/calls.log" || fail "fresh run did not use new mode"
if grep -Fq 'secret-must-not-be-an-argv' "$SANDBOX/argv.log"; then fail "secret leaked through process argv"; fi

run_bootstrap
[[ "$(grep -c '^installer ' "$SANDBOX/calls.log")" == 1 ]] || fail "repeat run must reuse the installed runtime"
grep -Fq -- '--mode existing' "$SANDBOX/calls.log" || fail "repeat run did not use existing mode"

if HERMES_TEST_POLICY_FAIL=1 run_bootstrap; then
  fail "profile policy failure must make bootstrap fail"
fi

# SSH and privilege validation happens before apt, firewall, or service writes.
system_calls_before="$(wc -l < "$SANDBOX/system.log")"
if env PATH="$SANDBOX/bin:$PATH" HERMES_TEST_SANDBOX="$SANDBOX" HERMES_TEST_EUID=0 \
  HERMES_ETC_DIR="$SANDBOX/etc" HERMES_USER=hermes SSH_PORT=2200 \
  SSH_CONNECTION='198.51.100.10 50000 203.0.113.5 2222' \
  bash "$SANDBOX/kit/bootstrap-vps.sh" >/dev/null 2>&1; then
  fail "explicit SSH_PORT mismatch must be rejected"
fi
[[ "$(wc -l < "$SANDBOX/system.log")" == "$system_calls_before" ]] || fail "SSH mismatch mutated system state"

if env PATH="$SANDBOX/bin:$PATH" HERMES_TEST_SANDBOX="$SANDBOX" HERMES_TEST_EUID=0 \
  HERMES_ETC_DIR="$SANDBOX/etc" HERMES_USER=root SSH_PORT=22 \
  bash "$SANDBOX/kit/bootstrap-vps.sh" >/dev/null 2>&1; then
  fail "root must not be accepted as HERMES_USER"
fi
[[ "$(wc -l < "$SANDBOX/system.log")" == "$system_calls_before" ]] || fail "root user rejection mutated system state"

if env PATH="$SANDBOX/bin:$PATH" HERMES_TEST_SANDBOX="$SANDBOX" HERMES_TEST_EUID=0 \
  HERMES_TEST_EXISTING_UID=0 HERMES_ETC_DIR="$SANDBOX/etc" HERMES_USER=admin SSH_PORT=22 \
  bash "$SANDBOX/kit/bootstrap-vps.sh" >/dev/null 2>&1; then
  fail "an existing UID 0 account must not be accepted"
fi
[[ "$(wc -l < "$SANDBOX/system.log")" == "$system_calls_before" ]] || fail "UID 0 rejection mutated system state"

# Without an override, the connected SSH server port is used. Leading zeroes
# are decimal input, not Bash octal.
env -u SSH_PORT PATH="$SANDBOX/bin:$PATH" HERMES_TEST_SANDBOX="$SANDBOX" HERMES_TEST_EUID=0 \
  HERMES_ETC_DIR="$SANDBOX/etc" HERMES_USER=hermes \
  SSH_CONNECTION='198.51.100.10 50000 203.0.113.5 2208' \
  bash "$SANDBOX/kit/bootstrap-vps.sh" >/dev/null
grep -Fq 'ufw allow 2208/tcp' "$SANDBOX/system.log" || fail "SSH_CONNECTION server port was not used"

env PATH="$SANDBOX/bin:$PATH" HERMES_TEST_SANDBOX="$SANDBOX" HERMES_TEST_EUID=0 \
  HERMES_ETC_DIR="$SANDBOX/etc" HERMES_USER=hermes SSH_PORT=08 \
  bash "$SANDBOX/kit/bootstrap-vps.sh" >/dev/null
grep -Fq 'ufw allow 8/tcp' "$SANDBOX/system.log" || fail "SSH_PORT=08 was not normalized as decimal"

# check-vps must fail closed when system controls are not verifiable or UFW is inactive.
cp "$CHECK" "$SANDBOX/kit/check-vps.sh"
CHECK_OUTPUT="$SANDBOX/check.out"
if env PATH="$SANDBOX/bin:$PATH" HOME="$SANDBOX/home" HERMES_USER=hermes HERMES_TEST_EUID=1000 HERMES_TEST_SANDBOX="$SANDBOX" \
  bash "$SANDBOX/kit/check-vps.sh" >"$CHECK_OUTPUT" 2>&1; then
  fail "non-root system source_gap must return nonzero"
fi
grep -Fq 'source_gap' "$CHECK_OUTPUT" || fail "non-root check did not report source_gap"

if env PATH="$SANDBOX/bin:$PATH" HERMES_TEST_SANDBOX="$SANDBOX" HERMES_TEST_EUID=0 \
  HERMES_TEST_UFW_STATUS=inactive HERMES_USER=hermes \
  bash "$SANDBOX/kit/check-vps.sh" >"$CHECK_OUTPUT" 2>&1; then
  fail "inactive UFW must return nonzero"
fi

printf 'VPS script contract checks passed.\n'
