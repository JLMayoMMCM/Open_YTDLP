from __future__ import annotations

from fastapi import APIRouter

from app import config
from app.ffmpeg_utils import get_ffmpeg_status
from app.models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    status = get_ffmpeg_status()
    return HealthResponse(
        ffmpeg_available=status["available"],
        ffmpeg_path=status["path"],
        ffmpeg_version=status["version"],
        output_dir=config.get_settings().output_dir,
    )
