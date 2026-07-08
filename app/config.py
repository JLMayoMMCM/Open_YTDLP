from __future__ import annotations

import threading
from pathlib import Path

from app.models import SettingsModel

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SETTINGS_FILE = DATA_DIR / "settings.json"
DEFAULT_OUTPUT_DIR = BASE_DIR / "downloads"

_lock = threading.Lock()
_current: SettingsModel | None = None


def load_settings() -> SettingsModel:
    global _current
    with _lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not SETTINGS_FILE.exists():
            settings = SettingsModel(output_dir=str(DEFAULT_OUTPUT_DIR))
            SETTINGS_FILE.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
            _current = settings
            return settings
        _current = SettingsModel.model_validate_json(SETTINGS_FILE.read_text(encoding="utf-8"))
        return _current


def get_settings() -> SettingsModel:
    global _current
    if _current is None:
        return load_settings()
    return _current


def save_settings(settings: SettingsModel) -> SettingsModel:
    global _current
    with _lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        SETTINGS_FILE.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
        _current = settings
        return settings
