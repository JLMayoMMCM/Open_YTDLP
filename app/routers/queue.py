from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import config, queue_manager
from app.ffmpeg_utils import get_ffmpeg_status
from app.models import JobRecord, QueueRequest
from app.ytdlp_service import ProbeError, resolve_needs_ffmpeg

router = APIRouter()


@router.post("/queue", response_model=JobRecord)
def add_to_queue(req: QueueRequest) -> JobRecord:
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="Please enter a URL.")

    ffmpeg_status = get_ffmpeg_status()
    if not ffmpeg_status["available"]:
        try:
            needs_ffmpeg = resolve_needs_ffmpeg(req.url.strip(), req.mode, req.resolution, req.audio_format)
        except ProbeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if needs_ffmpeg:
            raise HTTPException(
                status_code=400,
                detail=(
                    "ffmpeg was not found, and this option requires it to merge or convert "
                    "streams. Install it with `winget install Gyan.FFmpeg` (or download from "
                    "https://www.gyan.dev/ffmpeg/builds/ and add its bin folder to PATH), then "
                    "restart the app."
                ),
            )

    output_dir = config.get_settings().output_dir
    if not output_dir:
        raise HTTPException(status_code=400, detail="No output directory configured. Set one in Settings.")

    job = queue_manager.enqueue(req)
    return job


@router.get("/queue", response_model=list[JobRecord])
def get_queue() -> list[JobRecord]:
    return queue_manager.list_jobs()


@router.delete("/queue/{job_id}")
def delete_job(job_id: str) -> dict:
    ok = queue_manager.cancel(job_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled (not found or already started).")
    return {"ok": True}
