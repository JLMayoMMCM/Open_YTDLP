from __future__ import annotations

import asyncio
import queue
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app import config
from app.models import JobRecord, JobStatus, QueueRequest
from app.ws_manager import manager
from app.ytdlp_service import download

_job_queue: "queue.Queue[str | None]" = queue.Queue()
_jobs: dict[str, JobRecord] = {}
_jobs_lock = threading.Lock()
_worker_thread: threading.Thread | None = None
_app_loop: asyncio.AbstractEventLoop | None = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _app_loop
    _app_loop = loop


def list_jobs() -> list[JobRecord]:
    with _jobs_lock:
        return sorted(_jobs.values(), key=lambda j: j.created_at)


def get_job(job_id: str) -> JobRecord | None:
    with _jobs_lock:
        return _jobs.get(job_id)


def enqueue(req: QueueRequest) -> JobRecord:
    job = JobRecord(
        job_id=str(uuid4()),
        url=req.url,
        mode=req.mode,
        resolution=req.resolution,
        audio_format=req.audio_format,
        status=JobStatus.QUEUED,
        created_at=datetime.now(timezone.utc),
    )
    with _jobs_lock:
        _jobs[job.job_id] = job
    _job_queue.put(job.job_id)
    _push(job)
    return job


def cancel(job_id: str) -> bool:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None or job.status != JobStatus.QUEUED:
            return False
        job.status = JobStatus.CANCELLED
    _push(job)
    return True


def _push(job: JobRecord) -> None:
    payload = {"type": "progress", **job.model_dump(mode="json")}
    if _app_loop is None:
        return
    asyncio.run_coroutine_threadsafe(manager.broadcast(payload), _app_loop)


def _progress_hook_factory(job: JobRecord):
    def hook(d: dict) -> None:
        if d.get("status") == "downloading":
            job.status = JobStatus.DOWNLOADING
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            downloaded = d.get("downloaded_bytes")
            if total and downloaded is not None:
                job.percent = round(downloaded / total * 100, 1)
            job.speed = d.get("speed")
            job.eta = d.get("eta")
            job.filename = Path(d.get("filename", "")).name or job.filename
        elif d.get("status") == "finished":
            job.percent = 100.0
            job.filename = Path(d.get("filename", "")).name or job.filename
        _push(job)

    return hook


def _postprocessor_hook_factory(job: JobRecord):
    def hook(d: dict) -> None:
        pp_key = d.get("postprocessor", "")
        if d.get("status") == "started":
            if "ExtractAudio" in pp_key:
                job.status = JobStatus.CONVERTING
            else:
                job.status = JobStatus.MERGING
            _push(job)
        elif d.get("status") == "finished":
            info = d.get("info_dict") or {}
            filepath = info.get("filepath")
            if filepath:
                job.filename = Path(filepath).name
            _push(job)

    return hook


def _run_download(job: JobRecord) -> None:
    output_dir = Path(config.get_settings().output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    progress_hook = _progress_hook_factory(job)
    postprocessor_hook = _postprocessor_hook_factory(job)
    download(job, output_dir, progress_hook, postprocessor_hook)
    job.status = JobStatus.COMPLETED
    job.percent = 100.0
    _push(job)


def _worker_loop() -> None:
    while True:
        job_id = _job_queue.get()
        if job_id is None:
            break

        # Flip QUEUED -> DOWNLOADING under the same lock cancel() uses, so a
        # cancel request arriving just as the worker picks up the job can never
        # report success for a job that's already started.
        with _jobs_lock:
            job = _jobs.get(job_id)
            if job is None or job.status == JobStatus.CANCELLED:
                job = None
            else:
                job.status = JobStatus.DOWNLOADING

        if job is None:
            _job_queue.task_done()
            continue

        _push(job)
        try:
            _run_download(job)
        except Exception as exc:  # noqa: BLE001 - surface any yt-dlp/ffmpeg error to the UI
            job.status = JobStatus.ERROR
            job.error = str(exc)
            _push(job)
        finally:
            _job_queue.task_done()


def start_worker() -> None:
    global _worker_thread
    if _worker_thread is not None:
        return
    _worker_thread = threading.Thread(target=_worker_loop, name="download-worker", daemon=True)
    _worker_thread.start()


def stop_worker() -> None:
    _job_queue.put(None)
