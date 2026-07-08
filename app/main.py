from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from yt_dlp.utils import DownloadError

from app import config, queue_manager
from app.routers import health, probe, queue, settings, ws

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings_model = config.load_settings()
    Path(settings_model.output_dir).mkdir(parents=True, exist_ok=True)
    queue_manager.set_event_loop(asyncio.get_running_loop())
    queue_manager.start_worker()
    yield
    queue_manager.stop_worker()


app = FastAPI(title="YTDLP UI", lifespan=lifespan)


@app.exception_handler(DownloadError)
async def download_error_handler(request: Request, exc: DownloadError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": str(exc)})


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": str(exc), "type": exc.__class__.__name__})


app.include_router(health.router, prefix="/api")
app.include_router(probe.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(ws.router, prefix="/api")

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
