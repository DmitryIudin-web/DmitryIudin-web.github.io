"""Profile integration tests; all fixtures are synthetic and stay in temp dirs."""
import importlib.util
import json
import os
from pathlib import Path
import re
import tempfile
import subprocess
import unittest
from unittest.mock import patch

import yaml

KIT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ast_hermes_profile', KIT / 'profile.py')
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=os.environ.get('HERMES_TEST_TMPDIR'))
        self.addCleanup(self.temp.cleanup)
        # Resolve like profile.py does: Windows may hand out an 8.3 short name
        # (C:\\Users\\RUNNER~1\\...) for TEMP, and paths must compare equal.
        self.root = Path(self.temp.name).resolve()
        self.home = self.root / 'profile'
        self.home.mkdir()
        self.workspace = self.root / 'site with spaces'
        self.workspace.mkdir()

    def config(self, value):
        (self.home / 'config.yaml').write_text(yaml.safe_dump(value), encoding='utf-8')

    def read_config(self):
        return yaml.safe_load((self.home / 'config.yaml').read_text(encoding='utf-8'))

    def apply(self, mode='existing', dry_run=False):
        return profile.apply_profile(self.home, self.workspace, mode=mode, dry_run=dry_run)

    def test_existing_profile_keeps_integrations_and_private_data(self):
        existing = {
            'model': {'provider': 'openrouter', 'default': 'test-model'},
            'cron': {'model': 'scheduled-test-model'},
            'terminal': {'backend': 'local', 'cwd': '.'},
            'stt': {'provider': 'local', 'local': {'model': 'base'}},
            'fallback_providers': [{'provider': 'test-fallback'}],
            'approvals': {'mode': 'smart', 'deny': ['*existing-ban*'], 'timeout': 90},
            'secrets': {'test_only': 'SYNTHETIC_VALUE'},
        }
        self.config(existing)
        private = {'.env': b'TELEGRAM_BOT_TOKEN=TEST_VALUE_ONLY\r\n',
                   'auth.json': b'{"test": "SYNTHETIC_VALUE"}',
                   'memories/MEMORY.md': b'Personal test note\r\n',
                   'sessions/one.json': b'{"test": true}',
                   'cron/jobs.json': b'[{"id": "test-job"}]',
                   'skills/custom/SKILL.md': b'Existing custom skill'}
        for name, value in private.items():
            path = self.home / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(value)
        self.apply()
        actual = self.read_config()
        for key in ('model', 'cron', 'terminal', 'stt', 'fallback_providers', 'secrets'):
            self.assertEqual(actual[key], existing[key])
        self.assertEqual(actual['approvals']['mode'], 'manual')
        self.assertIn('*existing-ban*', actual['approvals']['deny'])
        for key in ('cron_mode', 'single_query_mode', 'unattended_mode'):
            self.assertEqual(actual['approvals'][key], 'deny')
        for name, value in private.items():
            self.assertEqual((self.home / name).read_bytes(), value)

    def test_new_profile_overlays_installer_defaults(self):
        self.config({'terminal': {'cwd': '.'}, 'model': {'provider': 'test-provider'}})
        (self.home / 'SOUL.md').write_text('Upstream default\n', encoding='utf-8')
        self.apply(mode='new')
        actual = self.read_config()
        self.assertEqual(actual['terminal']['cwd'], str(self.workspace.resolve()))
        self.assertEqual(actual['stt']['provider'], 'local')
        self.assertEqual(actual['model']['provider'], 'test-provider')
        self.assertTrue(profile.check_profile(self.home)['ok'])
        self.assertFalse((self.home / 'config.yaml.ast-template').exists())

    def test_second_apply_is_noop_and_preserves_personal_soul(self):
        self.config({'terminal': {'cwd': '.'}})
        original = 'Personal instructions in another language.\n'
        (self.home / 'SOUL.md').write_text(original, encoding='utf-8')
        first = self.apply()
        before = {str(p.relative_to(self.home)): p.read_bytes()
                  for p in self.home.rglob('*') if p.is_file()}
        second = self.apply()
        after = {str(p.relative_to(self.home)): p.read_bytes()
                 for p in self.home.rglob('*') if p.is_file()}
        self.assertTrue(first['changed'])
        self.assertEqual(second['changed'], [])
        self.assertEqual(before, after)
        soul = (self.home / 'SOUL.md').read_text(encoding='utf-8')
        self.assertTrue(soul.startswith(original))
        self.assertEqual(soul.count('<!-- ast-kit:begin -->'), 1)

    def test_dry_run_does_not_write_anything(self):
        self.config({'model': {'provider': 'test'}})
        before = {str(p.relative_to(self.home)): p.read_bytes()
                  for p in self.home.rglob('*') if p.is_file()}
        result = self.apply(dry_run=True)
        self.assertTrue(result['changed'])
        self.assertEqual(before, {str(p.relative_to(self.home)): p.read_bytes()
                                 for p in self.home.rglob('*') if p.is_file()})

    def test_backup_restores_exact_previous_config_and_soul(self):
        config = b'# custom comment\nmodel:\n  provider: test\n'
        soul = b'Keep this custom identity.\r\n'
        (self.home / 'config.yaml').write_bytes(config)
        (self.home / 'SOUL.md').write_bytes(soul)
        result = self.apply()
        backup = Path(result['backup'])
        self.assertEqual((backup / 'config.yaml').read_bytes(), config)
        self.assertEqual((backup / 'SOUL.md').read_bytes(), soul)
        self.assertFalse((backup / '.env').exists())
        if os.name != 'nt':
            self.assertEqual(backup.stat().st_mode & 0o777, 0o700)
            self.assertEqual((backup / 'config.yaml').stat().st_mode & 0o777, 0o600)

    def test_invalid_yaml_fails_without_modifications(self):
        path = self.home / 'config.yaml'
        path.write_bytes(b'approvals: [invalid\n')
        with self.assertRaises(profile.ProfileError):
            self.apply()
        self.assertEqual(path.read_bytes(), b'approvals: [invalid\n')
        self.assertEqual(sorted(p.name for p in self.home.iterdir()), ['config.yaml'])

    def test_home_inside_published_workspace_is_rejected(self):
        self.home = self.workspace / 'runtime'
        self.home.mkdir()
        self.config({})
        with self.assertRaises(profile.ProfileError):
            self.apply()

    def test_check_detects_missing_or_relaxed_policy(self):
        self.config({})
        self.assertFalse(profile.check_profile(self.home)['ok'])
        self.apply()
        self.assertTrue(profile.check_profile(self.home)['ok'])
        config = self.read_config()
        config['approvals']['mode'] = 'off'
        self.config(config)
        self.assertFalse(profile.check_profile(self.home)['ok'])

    def test_site_skill_and_manifest_point_to_shared_workspace(self):
        self.config({})
        self.apply()
        manifest = json.loads((self.home / 'ast-kit.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['workspace'], str(self.workspace.resolve()))
        skill = (self.home / 'skills/ast/avtonds-site/SKILL.md').read_text(encoding='utf-8')
        self.assertIn(str(self.workspace.resolve()), skill)
        self.assertNotIn('{{WORKSPACE}}', skill)

    def test_secret_like_values_do_not_appear_in_check_output(self):
        self.config({'providers': {'test': {'api_key': 'SYNTHETIC_PRIVATE_VALUE'}}})
        self.apply()
        self.assertNotIn('SYNTHETIC_PRIVATE_VALUE', json.dumps(profile.check_profile(self.home)))

    def test_legacy_runtime_is_not_declared_protected_by_saved_yaml(self):
        self.config({})
        self.apply()
        runtime = self.root / 'legacy'
        (runtime / 'hermes_cli').mkdir(parents=True)
        (runtime / 'tools').mkdir()
        (runtime / 'hermes_cli/__init__.py').write_text('__version__ = "0.17.0"\n')
        (runtime / 'tools/approval.py').write_text('def _get_approval_mode(): return "manual"\n')
        result = profile.check_profile(self.home, runtime)
        self.assertTrue(result['config_ok'])
        self.assertFalse(result['ok'])
        self.assertTrue(result['runtime']['upgrade_required'])

    def test_matching_function_names_are_not_runtime_compatibility_evidence(self):
        runtime = self.root / 'unverified-runtime'
        (runtime / 'hermes_cli').mkdir(parents=True)
        (runtime / 'tools').mkdir()
        (runtime / 'hermes_cli/__init__.py').write_text('__version__ = "0.21.1"\n')
        (runtime / 'tools/approval_floors.py').write_text(
            'deny_patterns = []\ndef _match_user_deny_rule(command): return False\n')
        self.assertFalse(profile.runtime_capabilities(runtime)['deny_policy_supported'])

    def test_permission_drift_is_reported_and_repaired_without_content_changes(self):
        self.config({'model': {'provider': 'test'}})
        first = self.apply()
        paths = [self.home / 'config.yaml', Path(first['backup']) / 'config.yaml']
        before = [p.read_bytes() for p in paths]
        for path in paths:
            if os.name == 'nt':
                subprocess.run(['icacls', str(path), '/grant', '*S-1-1-0:R'],
                               capture_output=True, check=True)
            else:
                path.chmod(0o644)
        self.assertFalse(profile.check_profile(self.home)['ok'])
        preview = self.apply(dry_run=True)
        self.assertIn('config.yaml', preview['permissions_changed'])
        self.apply()
        self.assertTrue(profile.check_profile(self.home)['ok'])
        self.assertEqual([p.read_bytes() for p in paths], before)

    def test_check_rejects_profile_equal_to_published_kit_root(self):
        self.config({})
        self.apply()
        section = profile._soul_section(self.workspace.resolve())
        skill = profile._skill_text(self.workspace.resolve())
        with patch.object(profile, 'KIT', self.home / 'scripts/hermes'):
            # The manifest remains a valid instance for the synthetic kit path.
            manifest_path = self.home / 'ast-kit.json'
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            manifest['kit'] = str(profile.KIT)
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
            with patch.object(profile, '_soul_section', return_value=section), patch.object(profile, '_skill_text', return_value=skill):
                self.assertFalse(profile.check_profile(self.home)['ok'])

    @unittest.skipIf(os.name == 'nt', 'POSIX permissions check')
    def test_filesystem_that_ignores_chmod_is_rejected_before_backup(self):
        self.config({'model': {'provider': 'test'}})
        path = self.home / 'config.yaml'
        original = path.read_bytes()
        # Simulate an existing broadly readable backup dir on a mount that
        # ignores chmod, as DrvFS does without metadata enabled.
        backup_root = self.home / '.ast-kit-backups'
        backup_root.mkdir(mode=0o755)
        backup_root.chmod(0o755)
        with patch.object(profile.os, 'chmod'):
            with self.assertRaises(OSError):
                self.apply()
        self.assertEqual(path.read_bytes(), original)
        self.assertEqual(list(backup_root.iterdir()), [])

    def test_incomplete_soul_section_fails_before_config_change(self):
        self.config({})
        before = (self.home / 'config.yaml').read_bytes()
        (self.home / 'SOUL.md').write_text('Personal text\n<!-- ast-kit:begin -->\n')
        with self.assertRaises(profile.ProfileError):
            self.apply()
        self.assertEqual((self.home / 'config.yaml').read_bytes(), before)

    def test_partial_write_failure_rolls_back_applied_files(self):
        self.config({'model': {'provider': 'test'}})
        before = (self.home / 'config.yaml').read_bytes()
        real_write = profile._atomic_write

        def write(path, content):
            if path == self.home / 'SOUL.md':
                raise PermissionError('synthetic write failure')
            real_write(path, content)

        with patch.object(profile, '_atomic_write', side_effect=write):
            with self.assertRaises(PermissionError):
                self.apply()
        self.assertEqual((self.home / 'config.yaml').read_bytes(), before)
        self.assertFalse((self.home / '.ast-kit-apply.lock').exists())

    def test_publishing_rules_cover_reported_git_variants(self):
        import fnmatch
        self.config({})
        self.apply()
        patterns = self.read_config()['approvals']['deny']
        for command in ('git push', 'git push origin HEAD:main',
                        'git push origin HEAD:refs/heads/main',
                        'git push -f origin feature', 'git push origin feature --force',
                        'git -C /workspace push origin main', 'gh pr merge 28'):
            with self.subTest(command=command):
                self.assertTrue(any(fnmatch.fnmatchcase(command, pattern) for pattern in patterns))

    def test_backup_link_cannot_copy_private_config_outside_profile(self):
        self.config({'providers': {'test': {'api_key': 'SYNTHETIC_PRIVATE_VALUE'}}})
        outside = self.workspace / 'public-backup'
        outside.mkdir()
        link = self.home / '.ast-kit-backups'
        if os.name == 'nt':
            subprocess.run(['powershell', '-NoProfile', '-Command',
                            'New-Item -ItemType Junction -Path $env:TEST_LINK -Target $env:TEST_TARGET | Out-Null'],
                           env={**os.environ, 'TEST_LINK': str(link), 'TEST_TARGET': str(outside)},
                           capture_output=True, check=True)
        else:
            link.symlink_to(outside, target_is_directory=True)
        # Remove the link itself before TemporaryDirectory cleanup, never its target.
        self.addCleanup(lambda: link.rmdir() if os.name == 'nt' else link.unlink())
        before = (self.home / 'config.yaml').read_bytes()
        with self.assertRaises(profile.ProfileError):
            self.apply()
        self.assertEqual(list(outside.iterdir()), [])
        self.assertEqual((self.home / 'config.yaml').read_bytes(), before)

    def test_check_rejects_empty_or_tampered_managed_content(self):
        self.config({})
        self.apply()
        for relative in ('ast-kit.json', 'SOUL.md', 'skills/ast/avtonds-site/SKILL.md'):
            path = self.home / relative
            original = path.read_bytes()
            with self.subTest(relative=relative):
                path.write_bytes(b'')
                self.assertFalse(profile.check_profile(self.home)['ok'])
            path.write_bytes(original)

    @unittest.skipUnless(os.name == 'nt', 'Windows ACL check')
    def test_windows_backup_and_managed_files_have_private_acl(self):
        self.config({'providers': {'test': {'api_key': 'SYNTHETIC_PRIVATE_VALUE'}}})
        result = self.apply()
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
        for path in (Path(result['backup']), Path(result['backup']) / 'config.yaml', self.home / 'config.yaml'):
            with self.subTest(path=path.name):
                size = wintypes.DWORD()
                get_security(str(path), 4, None, 0, ctypes.byref(size))
                descriptor = ctypes.create_string_buffer(size.value)
                self.assertTrue(get_security(str(path), 4, descriptor, size.value, ctypes.byref(size)))
                output = wintypes.LPWSTR()
                self.assertTrue(convert(descriptor, 1, 4, ctypes.byref(output), None))
                try:
                    sddl = output.value
                finally:
                    kernel.LocalFree(output)
                self.assertTrue(sddl.startswith('D:P'), sddl)
                self.assertEqual(sddl.count('(A;'), 2, sddl)
                # Well-known accounts render as aliases (LA for RID 500, SY for
                # SYSTEM); compare canonical SIDs, not the spelling.
                trustees = {profile._canonical_sid(t) for t in re.findall(r';;;([^)]+)\)', sddl)}
                self.assertIn('S-1-5-18', trustees, sddl)
                self.assertLessEqual(trustees, {'S-1-5-18', profile._windows_sid()}, sddl)
                for public_sid in ('AU', 'BU', 'WD'):
                    self.assertNotIn(f';;;{public_sid})', sddl)

    def test_windows_dacl_check_accepts_aliases_and_rejects_public_access(self):
        aliases = {'LA': 'S-1-5-21-1-2-3-500', 'SY': 'S-1-5-18', 'BA': 'S-1-5-32-544'}
        with patch.object(profile, '_windows_sid', return_value='S-1-5-21-1-2-3-500'), \
                patch.object(profile, '_canonical_sid', side_effect=lambda t: aliases.get(t, t)):
            private = profile._windows_dacl_is_private
            self.assertTrue(private('D:P(A;;FA;;;LA)(A;;FA;;;SY)', False))
            self.assertTrue(private('D:P(A;;FA;;;S-1-5-21-1-2-3-500)(A;;FA;;;SY)', False))
            self.assertTrue(private('D:P(A;OICI;FA;;;LA)(A;OICI;FA;;;SY)', True))
            self.assertTrue(private('D:P(A;;0x1f01ff;;;LA)(A;;FA;;;SY)', False))
            self.assertFalse(private('D:P(A;;FA;;;LA)(A;;FA;;;SY)', True))
            self.assertFalse(private('D:P(A;;FA;;;BA)(A;;FA;;;SY)', False))
            self.assertFalse(private('D:(A;;FA;;;LA)(A;;FA;;;SY)', False))
            self.assertFalse(private('D:P(A;ID;FA;;;LA)(A;;FA;;;SY)', False))
            self.assertFalse(private('D:P(A;;FR;;;LA)(A;;FA;;;SY)', False))
            self.assertFalse(private('D:P', False))

    def test_permission_failure_happens_before_writing_private_content(self):
        self.config({'provider': {'secret': 'SYNTHETIC_PRIVATE_VALUE'}})
        original = (self.home / 'config.yaml').read_bytes()
        real_permissions = profile._private_permissions

        def permissions(path):
            if path.is_file() and path.name.startswith('.ast-kit-'):
                self.assertEqual(path.read_bytes(), b'')
                raise PermissionError('synthetic ACL failure')
            real_permissions(path)

        with patch.object(profile, '_private_permissions', side_effect=permissions):
            with self.assertRaises(PermissionError):
                self.apply()
        self.assertEqual((self.home / 'config.yaml').read_bytes(), original)
        self.assertFalse((self.home / '.ast-kit-apply.lock').exists())

    def test_concurrent_config_edit_during_preparation_is_preserved(self):
        self.config({'model': {'provider': 'first'}})
        real_skill = profile._skill_text
        external = b'model:\n  provider: changed-by-running-runtime\n'

        def render(workspace):
            (self.home / 'config.yaml').write_bytes(external)
            return real_skill(workspace)

        with patch.object(profile, '_skill_text', side_effect=render):
            with self.assertRaises(profile.ProfileError):
                self.apply()
        self.assertEqual((self.home / 'config.yaml').read_bytes(), external)
        self.assertFalse((self.home / '.ast-kit-backups').exists())

    def test_updating_existing_skill_keeps_nested_backup_private(self):
        self.config({})
        self.apply()
        skill = self.home / 'skills/ast/avtonds-site/SKILL.md'
        old = b'Previous managed skill version\n'
        skill.write_bytes(old)
        result = self.apply()
        backup = Path(result['backup']) / 'skills/ast/avtonds-site/SKILL.md'
        self.assertEqual(backup.read_bytes(), old)
        self.assertTrue(profile.check_profile(self.home)['ok'])


if __name__ == '__main__':
    unittest.main()
