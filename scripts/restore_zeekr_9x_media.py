"""Prepare the archived ZEEKR 9X assets in the existing GitHub Pages artifact."""
import hashlib
import json
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "zeekr-9x/oem"
MANIFEST = Path(__file__).with_name("zeekr-9x-media.json")


def matches(path, asset):
    if not path.is_file() or path.stat().st_size != asset["size"]:
        return False
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest() == asset["sha256"]


def restore(asset):
    target = DEST / asset["path"]
    if matches(target, asset):
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    url = asset["url"]
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temp:
        partial = Path(temp.name)
    try:
        for source in (url, url + ("&" if "?" in url else "?") + "download=1"):
            result = subprocess.run(["curl", "--fail", "--silent", "--show-error", "--location",
                                     "--retry", "2", "--max-time", "120", "--output", str(partial), source])
            if result.returncode == 0 and matches(partial, asset):
                partial.chmod(0o644)
                partial.replace(target)
                return
        raise RuntimeError(f"Could not restore verified asset {asset['path']}")
    finally:
        partial.unlink(missing_ok=True)


if __name__ == "__main__":
    assets = json.loads(MANIFEST.read_text())
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(restore, assets))
    print(f"Verified {len(assets)} ZEEKR 9X assets")
