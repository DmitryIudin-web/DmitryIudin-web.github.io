#!/usr/bin/env python3
"""Connect a Hermes home to the AST kit without exporting its private data."""
import argparse
import copy
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import uuid

import yaml

KIT = Path(__file__).resolve().parent
BEGIN = '<!-- ast-kit:begin -->'
END = '<!-- ast-kit:end -->'
SKILL = Path('skills/ast/avtonds-site/SKILL.md')
REQUIRED_DENY = ('*git*push*', '*gh*pr*merge*')
# Reviewed at upstream commit 6e2b8e070d28b1a3381a3fb290b6b8d6cce13cef.
# Unknown revisions need review; matching a function name is not evidence.
REVIEWED_SOURCE_SHA256 = {
    'hermes_cli/__init__.py': 'efae023ac37622277aac298ac15c646b855e870132c38970feeda9552f1ecc27',
    'tools/approval.py': 'e48f1909968b253907fca01e9dad0593bee7a2bf7cf5278470c6d15a5150359f',
    'tools/approval_floors.py': 'e922d5682609cdf79ccc553902d76c8bfff05add61a5b6b7548b178933893759',
    'tools/terminal_tool.py': '5ca8d06f9cc42f8f8672d76bca5efcc4c523a24244a345529a76e2b3c5c4cbb7',
}


class ProfileError(ValueError):
    pass


def _read(path):
    if path.is_symlink():
        raise ProfileError('Managed files must not be symbolic links.')
    return path.read_bytes() if path.exists() else None


def _managed_path(home, relative):
    """Reject links, including Windows junctions, along a managed path."""
    path = home
    for part in Path(relative).parts:
        path = path / part
        try:
            info = path.lstat()
        except FileNotFoundError:
            continue
        if (stat.S_ISLNK(info.st_mode)
                or getattr(info, 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT):
            raise ProfileError('Managed paths must not contain links or junctions.')
    if not path.resolve().is_relative_to(home):
        raise ProfileError('A managed path points outside the profile.')
    return path


@lru_cache(maxsize=1)
def _windows_sid():
    output = subprocess.check_output(['whoami', '/user', '/fo', 'csv', '/nh'], timeout=10)
    match = re.search(rb'S-1-[0-9-]+', output)
    if not match:
        raise OSError('Cannot resolve the profile owner SID.')
    return match[0].decode('ascii')


def _windows_dacl(path):
    import ctypes
    from ctypes import wintypes
    security = ctypes.WinDLL('advapi32', use_last_error=True)
    get_security = security.GetFileSecurityW
    get_security.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_void_p,
                            wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    get_security.restype = wintypes.BOOL
    convert = security.ConvertSecurityDescriptorToStringSecurityDescriptorW
    convert.argtypes = [ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD,
                        ctypes.POINTER(wintypes.LPWSTR), ctypes.POINTER(wintypes.DWORD)]
    convert.restype = wintypes.BOOL
    kernel = ctypes.WinDLL('kernel32')
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    size = wintypes.DWORD()
    get_security(str(path), 4, None, 0, ctypes.byref(size))
    descriptor = ctypes.create_string_buffer(size.value)
    if not get_security(str(path), 4, descriptor, size.value, ctypes.byref(size)):
        raise ctypes.WinError(ctypes.get_last_error())
    output = wintypes.LPWSTR()
    if not convert(descriptor, 1, 4, ctypes.byref(output), None):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return output.value
    finally:
        kernel.LocalFree(output)


@lru_cache(maxsize=None)
def _canonical_sid(token):
    """Expand an SDDL trustee (an alias such as LA, BA or SY, or S-1-...) to S-1-... form.

    ConvertSecurityDescriptorToStringSecurityDescriptor abbreviates well-known
    accounts when it renders a DACL: the built-in Administrator (RID 500) comes
    back as LA even though whoami reported its S-1-5-21-...-500 SID. Comparing
    canonical SIDs keeps the check meaningful on such accounts (GitHub's Windows
    runners among them) instead of failing on the spelling.
    """
    import ctypes
    from ctypes import wintypes
    security = ctypes.WinDLL('advapi32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32')
    to_sid = security.ConvertStringSidToSidW
    to_sid.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(ctypes.c_void_p)]
    to_sid.restype = wintypes.BOOL
    to_string = security.ConvertSidToStringSidW
    to_string.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.LPWSTR)]
    to_string.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    sid = ctypes.c_void_p()
    if not to_sid(token, ctypes.byref(sid)):
        return token
    try:
        text = wintypes.LPWSTR()
        if not to_string(sid, ctypes.byref(text)):
            return token
        try:
            return text.value
        finally:
            kernel.LocalFree(text)
    finally:
        kernel.LocalFree(sid)


def _windows_dacl_is_private(sddl, is_dir):
    """True when a protected DACL grants full access only to the owner and SYSTEM."""
    if not sddl.startswith('D:P'):
        return False
    aces = re.findall(r'\(([^()]+)\)', sddl)
    if not aces:
        return False
    inherit = 'OICI' if is_dir else ''
    trusted = {'S-1-5-18', _canonical_sid(_windows_sid())}
    for ace in aces:
        fields = ace.split(';')
        if len(fields) != 6:
            return False
        kind, flags, rights, _, _, trustee = fields
        if kind != 'A' or flags != inherit or rights.upper() not in ('FA', '0X1F01FF'):
            return False
        if _canonical_sid(trustee) not in trusted:
            return False
    return True


def _permissions_are_private(path):
    if os.name != 'nt':
        return stat.S_IMODE(path.stat().st_mode) == (0o700 if path.is_dir() else 0o600)
    return _windows_dacl_is_private(_windows_dacl(path), path.is_dir())


def _backup_paths(home):
    root = _managed_path(home, '.ast-kit-backups')
    pending = [root] if root.exists() else []
    while pending:
        path = pending.pop()
        yield path
        if path.is_dir():
            pending.extend(_managed_path(home, child.relative_to(home)) for child in path.iterdir())


def _private_permissions(path):
    """Apply owner-only permissions before writing private content."""
    if os.name != 'nt':
        os.chmod(path, 0o700 if path.is_dir() else 0o600)
        if not _permissions_are_private(path):
            raise OSError('The filesystem does not enforce private permissions.')
        return
    import ctypes
    from ctypes import wintypes
    security = ctypes.WinDLL('advapi32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    convert = security.ConvertStringSecurityDescriptorToSecurityDescriptorW
    convert.argtypes = [wintypes.LPCWSTR, wintypes.DWORD,
                        ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(wintypes.DWORD)]
    convert.restype = wintypes.BOOL
    set_security = security.SetFileSecurityW
    set_security.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_void_p]
    set_security.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    inherit = 'OICI' if path.is_dir() else ''
    sddl = f'D:P(A;{inherit};FA;;;{_windows_sid()})(A;{inherit};FA;;;SY)'
    descriptor = ctypes.c_void_p()
    if not convert(sddl, 1, ctypes.byref(descriptor), None):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        # PROTECTED_DACL_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION.
        if not set_security(str(path), 0x80000004, descriptor):
            raise ctypes.WinError(ctypes.get_last_error())
    finally:
        kernel.LocalFree(descriptor)
    # SIDs and access masks only; the SDDL never contains file content.
    sddl = _windows_dacl(path)
    if not _windows_dacl_is_private(sddl, path.is_dir()):
        raise OSError(f'Private Windows permissions could not be verified: DACL {sddl!r}, '
                      f'owner SID {_windows_sid()!r}.')


def _manifest(workspace):
    return {'schema': 1, 'workspace': str(workspace), 'kit': str(KIT),
            'managed_files': ['config.yaml', 'SOUL.md', SKILL.as_posix()],
            'policy': 'manual-no-agent-publishing',
            'runtime_verification': 'Run check --runtime before claiming protection.'}


def _soul_section(workspace):
    body = (KIT / 'hermes-home/SOUL.md').read_text(encoding='utf-8').rstrip()
    return f'{BEGIN}\n{body}\n\nРабочая копия сайта: {workspace}\n{END}'


def _skill_text(workspace):
    return (KIT / 'hermes-home' / SKILL).read_text(encoding='utf-8').replace('{{WORKSPACE}}', str(workspace))


def _mapping(data, name):
    if data is None:
        return {}
    if not isinstance(data, dict):
        raise ProfileError(f'{name} must be a YAML mapping.')
    return data


def _config(path):
    return _parse_config(_read(path))


def _parse_config(raw):
    try:
        return _mapping(yaml.safe_load(raw) if raw is not None else {}, 'config')
    except (yaml.YAMLError, UnicodeError):
        # Parser errors can quote credential-bearing source lines.
        raise ProfileError('Cannot parse config.yaml; no settings were applied.') from None


def _merge(base, overlay):
    result = copy.deepcopy(base)
    for key, value in overlay.items():
        if isinstance(value, dict):
            result[key] = _merge(_mapping(result.get(key), key), value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def runtime_capabilities(runtime):
    """Inspect source only; never import or start the selected runtime."""
    runtime = Path(runtime).resolve()
    path = runtime / 'hermes_cli/__init__.py'
    text = path.read_text(encoding='utf-8') if path.is_file() else ''
    match = re.search(r'^__version__\s*=\s*[\"\']([^\"\']+)', text, re.M)
    supported = bool(match and match[1] == '0.21.1') and all(
        (runtime / relative).is_file()
        and hashlib.sha256((runtime / relative).read_bytes()).hexdigest() == digest
        for relative, digest in REVIEWED_SOURCE_SHA256.items())
    return {'version': match[1] if match else None,
            'verification': 'reviewed-source-fingerprints',
            'deny_policy_supported': supported, 'upgrade_required': not supported}


def _atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.ast-kit-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            _private_permissions(Path(temporary))
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def apply_profile(home, workspace, *, mode='existing', dry_run=False):
    home, workspace = Path(home).resolve(), Path(workspace).resolve()
    if mode not in ('existing', 'new'):
        raise ProfileError('Mode must be existing or new.')
    if not home.is_dir() or not workspace.is_dir():
        raise ProfileError('Profile home and workspace must already exist.')
    for public_root in (workspace, KIT.parent.parent):
        if home == public_root or public_root in home.parents:
            raise ProfileError('The private profile must stay outside the published repository.')
    for relative in ('config.yaml', 'SOUL.md', str(SKILL), 'ast-kit.json', '.ast-kit-backups', '.ast-kit-apply.lock'):
        _managed_path(home, relative)
    config_original = _read(home / 'config.yaml')
    original = _parse_config(config_original)
    template = _config(KIT / 'hermes-home/config.yaml')
    result = _merge(original, template) if mode == 'new' else copy.deepcopy(original)
    prior = _mapping(original.get('approvals'), 'approvals')
    approvals = _mapping(result.get('approvals'), 'approvals')
    prior_deny = prior.get('deny') or []
    if not isinstance(prior_deny, list) or not all(isinstance(p, str) for p in prior_deny):
        raise ProfileError('approvals.deny must be a list of strings.')
    approvals.update(mode='manual', cron_mode='deny', single_query_mode='deny', unattended_mode='deny')
    approvals.setdefault('timeout', 300)
    approvals['deny'] = list(dict.fromkeys(prior_deny + template['approvals']['deny'] + list(REQUIRED_DENY)))
    result['approvals'] = approvals
    if mode == 'new':
        result.setdefault('terminal', {})['cwd'] = str(workspace)
    soul_original = _read(home / 'SOUL.md')
    soul_bytes = soul_original or b''
    try:
        soul = soul_bytes.decode('utf-8')
    except UnicodeError:
        raise ProfileError('SOUL.md must be UTF-8; the original was kept.') from None
    if soul.count(BEGIN) != soul.count(END) or soul.count(BEGIN) > 1:
        raise ProfileError('SOUL.md contains an incomplete or duplicate AST section.')
    section = _soul_section(workspace)
    if BEGIN in soul:
        start, finish = soul.index(BEGIN), soul.index(END) + len(END)
        if finish <= start:
            raise ProfileError('SOUL.md has invalid AST section ordering.')
        soul = soul[:start] + section + soul[finish:]
    else:
        soul += ('\n' if soul.endswith('\n') else '\n\n') if soul else ''
        soul += section + '\n'
    skill = _skill_text(workspace)
    manifest = _manifest(workspace)
    desired = {
        Path('config.yaml'): yaml.safe_dump(result, allow_unicode=True, sort_keys=False).encode('utf-8'),
        Path('SOUL.md'): soul.encode('utf-8'), SKILL: skill.encode('utf-8'),
        Path('ast-kit.json'): (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
    }
    before = {}
    for relative in desired:
        target = _managed_path(home, relative)
        before[relative] = _read(target)
    if before[Path('config.yaml')] != config_original or before[Path('SOUL.md')] != soul_original:
        raise ProfileError('Profile changed during preparation; inspect and retry.')
    if original == result and before[Path('config.yaml')] is not None:
        desired[Path('config.yaml')] = before[Path('config.yaml')]
    changed = [p for p in desired if desired[p] != before[p]]
    permission_paths = [home / p for p in desired if before[p] is not None] + list(_backup_paths(home))
    permission_changes = [p for p in permission_paths if not _permissions_are_private(p)]
    summary = {'changed': [p.as_posix() for p in changed],
               'permissions_changed': [p.relative_to(home).as_posix() for p in permission_changes],
               'dry_run': dry_run, 'backup': None}
    if dry_run or not (changed or permission_changes):
        return summary
    lock = home / '.ast-kit-apply.lock'
    try:
        lock.mkdir(mode=0o700)
    except FileExistsError:
        raise ProfileError('Another profile apply is pending; inspect the lock before retrying.') from None
    try:
        if any(_read(home / p) != before[p] for p in desired):
            raise ProfileError('Profile changed during preparation; inspect and retry.')
        for path in permission_changes:
            _private_permissions(_managed_path(home, path.relative_to(home)))
        if not changed:
            return summary
        backup_root = _managed_path(home, '.ast-kit-backups')
        backup_root.mkdir(mode=0o700, exist_ok=True)
        _private_permissions(backup_root)
        backup = _managed_path(home, Path('.ast-kit-backups') / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]))
        backup.mkdir(mode=0o700)
        _private_permissions(backup)
        for relative in changed:
            if before[relative] is not None:
                parent = backup
                for part in relative.parent.parts:
                    parent = _managed_path(home, (parent / part).relative_to(home))
                    parent.mkdir(mode=0o700, exist_ok=True)
                    _private_permissions(parent)
                _atomic_write(_managed_path(home, (backup / relative).relative_to(home)), before[relative])
        summary['backup'] = str(backup)
        applied = []
        try:
            for relative in changed:
                _atomic_write(_managed_path(home, relative), desired[relative])
                applied.append(relative)
        except OSError:
            for relative in reversed(applied):
                if before[relative] is None:
                    (home / relative).unlink()
                else:
                    _atomic_write(home / relative, before[relative])
            raise
    finally:
        lock.rmdir()
    return summary


def check_profile(home, runtime=None):
    home = Path(home).resolve()
    issues = []
    config = _config(_managed_path(home, 'config.yaml'))
    approvals = _mapping(config.get('approvals'), 'approvals')
    if approvals.get('mode') != 'manual':
        issues.append('approvals.mode must be manual')
    for name in ('cron_mode', 'single_query_mode', 'unattended_mode'):
        if approvals.get(name) != 'deny':
            issues.append(f'approvals.{name} must be deny')
    deny = approvals.get('deny') or []
    if not isinstance(deny, list) or not all(isinstance(p, str) for p in deny) or not all(p in deny for p in REQUIRED_DENY):
        issues.append('Required publishing deny rules are missing')
    try:
        manifest = json.loads(_read(_managed_path(home, 'ast-kit.json')) or b'{}')
        workspace_value = manifest.get('workspace') if isinstance(manifest, dict) else None
        if not isinstance(workspace_value, str) or not Path(workspace_value).is_absolute():
            raise ProfileError('Invalid workspace in ast-kit.json')
        workspace = Path(workspace_value).resolve()
        if not workspace.is_dir() or manifest != _manifest(workspace):
            raise ProfileError('AST manifest does not match this kit and workspace')
        if any(home == root or root in home.parents for root in (workspace, KIT.parent.parent)):
            raise ProfileError('Private profile must stay outside the published repository')
        soul = (_read(_managed_path(home, 'SOUL.md')) or b'').decode('utf-8')
        if soul.count(BEGIN) != 1 or soul.count(END) != 1 or _soul_section(workspace) not in soul:
            issues.append('SOUL.md is missing the current AST section')
        skill = (_read(_managed_path(home, SKILL)) or b'').decode('utf-8')
        if skill != _skill_text(workspace):
            issues.append('Site skill does not match the current kit and workspace')
    except (ValueError, UnicodeError, OSError):
        # Do not include malformed JSON or file content in the report.
        issues.append('Managed profile metadata is missing, invalid or inaccessible')
    try:
        permission_paths = [_managed_path(home, p) for p in ('config.yaml', 'SOUL.md', str(SKILL), 'ast-kit.json')]
        permission_paths += list(_backup_paths(home))
        if any(p.exists() and not _permissions_are_private(p) for p in permission_paths):
            issues.append('Managed files or backups have non-private permissions; reapply the profile')
    except (ProfileError, OSError):
        issues.append('Cannot verify private permissions of managed files and backups')
    config_ok = not issues
    capabilities = runtime_capabilities(runtime) if runtime is not None else None
    if capabilities and not capabilities['deny_policy_supported']:
        issues.append('Runtime source is not the reviewed deny implementation; use the reviewed revision before relying on this policy')
    return {'ok': not issues, 'config_ok': config_ok,
            'scope': 'profile-and-reviewed-source' if runtime is not None else 'configuration-only',
            'runtime': capabilities, 'issues': issues}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    apply = commands.add_parser('apply')
    apply.add_argument('--home', required=True, type=Path)
    apply.add_argument('--workspace', required=True, type=Path)
    apply.add_argument('--mode', choices=('new', 'existing'), default='existing')
    apply.add_argument('--dry-run', action='store_true')
    check = commands.add_parser('check')
    check.add_argument('--home', required=True, type=Path)
    check.add_argument('--runtime', required=True, type=Path)
    capabilities = commands.add_parser('capabilities')
    capabilities.add_argument('--runtime', required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.command == 'apply':
            result = apply_profile(args.home, args.workspace, mode=args.mode, dry_run=args.dry_run)
            exit_code = 0
        elif args.command == 'check':
            result = check_profile(args.home, args.runtime)
            exit_code = 0 if result['ok'] else 2
        else:
            result = runtime_capabilities(args.runtime)
            exit_code = 2 if result['upgrade_required'] else 0
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return exit_code
    except (ProfileError, OSError) as exc:
        print(json.dumps({'ok': False, 'error': str(exc) if isinstance(exc, ProfileError) else 'File operation failed; inspect local permissions and backup.'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
