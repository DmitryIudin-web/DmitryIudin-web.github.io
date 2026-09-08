#!/usr/bin/env python3
"""Exercise the installed terminal handler in a temporary, credential-free home."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

PREFIX = 'AST_RUNTIME_PROBE='


def worker():
    # The parent supplies an isolated HERMES_HOME before any runtime import.
    from tools.terminal_tool import _handle_terminal, terminal_tool
    from tools.terminal_tool_lifecycle import cleanup_all_environments
    from tools import approval

    def call(command, **extra):
        return json.loads(_handle_terminal({'command': command, 'timeout': 10, **extra},
                                           task_id='ast-kit-probe'))

    commands = {
        'push': 'echo git push',
        'main_ref': 'echo git push origin HEAD:refs/heads/main',
        'force_push': 'echo git -C test push --force origin main',
        'merge': 'echo gh pr merge 28',
    }
    try:
        ordinary = call('echo AST_KIT_OK')
        blocked = {name: call(command).get('status') == 'blocked'
                   for name, command in commands.items()}
        extra_force = call(commands['push'], force=True).get('status') == 'blocked'
        token = approval.set_current_session_key('ast-kit-probe')
        try:
            approval.enable_session_yolo('ast-kit-probe')
            yolo_blocked = call(commands['push']).get('status') == 'blocked'
        finally:
            approval.disable_session_yolo('ast-kit-probe')
            approval.reset_current_session_key(token)
        # This echo is harmless even when the trusted internal force flag bypasses guards.
        internal = json.loads(terminal_tool(commands['push'], timeout=10,
                                            task_id='ast-kit-probe', force=True))
        normal_ok = ordinary.get('exit_code') == 0 and 'AST_KIT_OK' in ordinary.get('output', '')
        result = {
            'ok': normal_ok and all(blocked.values()) and extra_force and yolo_blocked,
            'scope': 'registered-terminal-handler',
            'ordinary_command_executed': normal_ok,
            'blocked': blocked,
            'model_force_argument_ignored': extra_force,
            'session_yolo_still_blocked': yolo_blocked,
            'trusted_internal_force_bypasses_deny': internal.get('exit_code') == 0,
            'full_process_isolation_verified': False,
        }
    finally:
        cleanup_all_environments()
    print(PREFIX + json.dumps(result))
    return 0 if result['ok'] else 2


def verify(runtime):
    import profile as kit_profile
    import yaml

    runtime = runtime.resolve()
    capabilities = kit_profile.runtime_capabilities(runtime)
    if not capabilities['deny_policy_supported']:
        return {'ok': False, 'error': 'Runtime does not match the reviewed source.',
                'runtime': capabilities}, 2
    candidates = [runtime / name / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
                  for name in ('venv', '.venv')]
    python = next((p for p in candidates if p.is_file()), None)
    if python is None:
        return {'ok': False, 'error': 'No installed runtime environment found.'}, 2
    with tempfile.TemporaryDirectory(prefix='ast-runtime-probe-') as temporary:
        root = Path(temporary).resolve()
        home = root / 'home'
        home.mkdir()
        workspace = root / 'workspace'
        workspace.mkdir()
        config = yaml.safe_load((Path(__file__).parent / 'hermes-home/config.yaml').read_text(encoding='utf-8'))
        config['terminal'] = {'backend': 'local', 'cwd': str(workspace)}
        (home / 'config.yaml').write_text(yaml.safe_dump(config), encoding='utf-8')
        # Keep OS executables discoverable, but inherit no provider keys, profile or proxy settings.
        keep = {'PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'SYSTEMDRIVE'}
        env = {k: v for k, v in os.environ.items() if k.upper() in keep}
        env.update(HERMES_HOME=str(home), HOME=str(home), USERPROFILE=str(home),
                   PYTHONPATH=str(runtime), PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1',
                   TEMP=str(root), TMP=str(root), TMPDIR=str(root),
                   GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull)
        run = subprocess.run([str(python), str(Path(__file__).resolve()), '--worker'],
                             cwd=workspace, env=env, capture_output=True, text=True,
                             encoding='utf-8', errors='replace', timeout=120)
        lines = [line[len(PREFIX):] for line in run.stdout.splitlines() if line.startswith(PREFIX)]
        if not lines:
            return {'ok': False, 'error': 'Isolated runtime probe failed before producing evidence.',
                    'exit_code': run.returncode}, 2
        result = json.loads(lines[-1])
        result['runtime'] = capabilities
        return result, 0 if run.returncode == 0 and result['ok'] else 2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path)
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        return worker()
    if args.runtime is None:
        parser.error('--runtime is required')
    try:
        result, code = verify(args.runtime)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        result, code = {'ok': False, 'error': 'Runtime probe failed; no live profile was used.'}, 2
    print(json.dumps(result, indent=2))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
