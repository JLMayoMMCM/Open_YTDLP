from __future__ import annotations

import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BUNDLED_FFMPEG = BASE_DIR / "bin" / "ffmpeg.exe"


def find_ffmpeg() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    if BUNDLED_FFMPEG.exists():
        return str(BUNDLED_FFMPEG)
    return None


@lru_cache(maxsize=1)
def get_ffmpeg_status() -> dict:
    path = find_ffmpeg()
    if not path:
        return {"available": False, "path": None, "version": None}
    try:
        result = subprocess.run(
            [path, "-version"], capture_output=True, text=True, timeout=5, check=False
        )
        version = result.stdout.splitlines()[0] if result.stdout else "unknown"
    except Exception:
        version = "unknown"
    return {"available": True, "path": path, "version": version}


def refresh_ffmpeg_status() -> dict:
    get_ffmpeg_status.cache_clear()
    return get_ffmpeg_status()
