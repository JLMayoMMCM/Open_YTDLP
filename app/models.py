from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class Mode(str, Enum):
    VIDEO_AUDIO = "video_audio"
    VIDEO_ONLY = "video_only"
    AUDIO_ONLY = "audio_only"


class AudioFormat(str, Enum):
    BEST = "best"
    MP3 = "mp3"
    M4A = "m4a"


class JobStatus(str, Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    MERGING = "merging"
    CONVERTING = "converting"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"


class ProbeRequest(BaseModel):
    url: str


class ProbeResponse(BaseModel):
    video_id: str
    title: str
    thumbnail: str | None = None
    duration: int | None = None
    uploader: str | None = None
    heights: list[int] = Field(default_factory=list)
    progressive_heights: list[int] = Field(default_factory=list)
    has_audio: bool = True
    webpage_url: str


class QueueRequest(BaseModel):
    url: str
    mode: Mode
    resolution: str = "best"
    audio_format: AudioFormat = AudioFormat.BEST


class JobRecord(BaseModel):
    job_id: str
    url: str
    mode: Mode
    resolution: str
    audio_format: AudioFormat
    title: str | None = None
    status: JobStatus = JobStatus.QUEUED
    percent: float | None = None
    speed: float | None = None
    eta: int | None = None
    filename: str | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SettingsModel(BaseModel):
    output_dir: str


class HealthResponse(BaseModel):
    ffmpeg_available: bool
    ffmpeg_path: str | None = None
    ffmpeg_version: str | None = None
    output_dir: str
