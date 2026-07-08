from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from app import config
from app.models import SettingsModel

router = APIRouter()


@router.get("/settings", response_model=SettingsModel)
def get_settings() -> SettingsModel:
    return config.get_settings()


@router.post("/settings", response_model=SettingsModel)
def update_settings(settings: SettingsModel) -> SettingsModel:
    path = Path(settings.output_dir).expanduser()
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Cannot write to that folder: {exc}") from exc
    resolved = SettingsModel(output_dir=str(path))
    return config.save_settings(resolved)
