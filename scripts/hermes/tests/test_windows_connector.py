import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

KIT = Path(__file__).resolve().parents[1]
POWERSHELL = shutil.which('pwsh') or (shutil.which('powershell') if os.name == 'nt' else None)


@unittest.skipUnless(POWERSHELL, 'PowerShell is required for the Windows adapter')
class WindowsConnectorTests(unittest.TestCase):
    def test_preview_and_apply_preserve_private_file_and_report_old_runtime(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get('HERMES_TEST_TMPDIR')) as temporary:
            root = Path(temporary)
            home, runtime, workspace = root / 'profile', root / 'runtime', root / 'site'
            for path in (home, workspace, runtime / 'hermes_cli'):
                path.mkdir(parents=True)
            (home / 'config.yaml').write_text('model:\n  provider: test\n')
            secret = b'TELEGRAM_BOT_TOKEN=TEST_VALUE_ONLY\r\n'
            (home / '.env').write_bytes(secret)
            (runtime / 'hermes_cli/__init__.py').write_text('__version__ = "0.17.0"\n')
            command = [POWERSHELL, '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                       str(KIT / 'connect-existing.ps1'), '-HermesHome', str(home),
                       '-RuntimeDir', str(runtime), '-Workspace', str(workspace), '-Python', sys.executable]
            before = (home / 'config.yaml').read_bytes()
            workspace_index = command.index('-Workspace')
            default_preview = command[:workspace_index] + command[workspace_index + 2:]
            preview = subprocess.run(default_preview, capture_output=True, text=True, timeout=30)
            self.assertEqual(preview.returncode, 0, preview.stderr)
            self.assertIn('"upgrade_required": true', preview.stdout)
            self.assertEqual((home / 'config.yaml').read_bytes(), before)
            applied = subprocess.run(command + ['-Apply'], capture_output=True, text=True, timeout=30)
            self.assertEqual(applied.returncode, 2, applied.stderr)
            self.assertEqual((home / '.env').read_bytes(), secret)
            manifest = json.loads((home / 'ast-kit.json').read_text(encoding='utf-8'))
            self.assertEqual(manifest['workspace'], str(workspace))
            self.assertNotIn('TEST_VALUE_ONLY', applied.stdout)
