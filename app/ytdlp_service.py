from __future__ import annotations

from pathlib import Path
from typing import Callable

import yt_dlp

from app.ffmpeg_utils import find_ffmpeg
from app.models import AudioFormat, JobRecord, Mode, ProbeResponse

RESOLUTION_BUCKETS = [2160, 1440, 1080, 720, 480, 360, 240, 144]

BASE_YDL_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    "skip_download": True,
}


class ProbeError(ValueError):
    pass


def probe(url: str) -> ProbeResponse:
    try:
        with yt_dlp.YoutubeDL(BASE_YDL_OPTS) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        raise ProbeError(str(exc)) from exc

    if not info:
        raise ProbeError("Could not read any information for that URL.")

    if info.get("_type") == "playlist":
        raise ProbeError("Playlists are not supported yet — paste a single video URL.")

    formats = info.get("formats") or []
    heights = sorted(
        {
            f["height"]
            for f in formats
            if f.get("height") and f.get("vcodec") not in (None, "none")
        },
        reverse=True,
    )
    progressive_heights = sorted(
        {
            f["height"]
            for f in formats
            if f.get("height")
            and f.get("vcodec") not in (None, "none")
            and f.get("acodec") not in (None, "none")
        },
        reverse=True,
    )
    has_audio = any(f.get("acodec") not in (None, "none") for f in formats)

    return ProbeResponse(
        video_id=info.get("id", ""),
        title=info.get("title", "Unknown"),
        thumbnail=info.get("thumbnail"),
        duration=info.get("duration"),
        uploader=info.get("uploader"),
        heights=heights,
        progressive_heights=progressive_heights,
        has_audio=has_audio,
        webpage_url=info.get("webpage_url", url),
    )


def build_format_selector(mode: Mode, resolution: str) -> str:
    height_clause = "" if resolution == "best" else f"[height<={int(resolution)}]"

    if mode is Mode.VIDEO_AUDIO:
        return f"bestvideo{height_clause}+bestaudio/best{height_clause}"
    if mode is Mode.VIDEO_ONLY:
        return f"bestvideo{height_clause}"
    if mode is Mode.AUDIO_ONLY:
        return "bestaudio/best"
    raise ValueError(f"Unknown mode: {mode}")


def requires_ffmpeg(
    mode: Mode,
    resolution: str,
    audio_format: AudioFormat,
    heights: list[int],
    progressive_heights: list[int],
) -> bool:
    """Cheap heuristic for UI hints (labeling/disabling dropdown options) — does not
    do a network round-trip. Can under/over-predict in fps/bitrate tie-break edge
    cases; resolve_needs_ffmpeg() below is the authoritative check used server-side
    before actually enqueueing a job."""
    if mode is Mode.AUDIO_ONLY:
        return audio_format is not AudioFormat.BEST
    if mode is Mode.VIDEO_AUDIO:
        cap = None if resolution == "best" else int(resolution)
        candidates = [h for h in heights if cap is None or h <= cap]
        if not candidates:
            return False
        # yt-dlp's bestvideo[...] picks the tallest candidate; if that height
        # isn't available as a progressive (already-muxed) stream, a merge is needed.
        return max(candidates) not in progressive_heights
    return False


def resolve_needs_ffmpeg(url: str, mode: Mode, resolution: str, audio_format: AudioFormat) -> bool:
    """Authoritative check: resolves the real format selector against yt-dlp's own
    format-selection logic (fps/bitrate tie-breaks included) to see whether the
    formats it would actually pick require a merge/re-encode."""
    if mode is Mode.AUDIO_ONLY:
        return audio_format is not AudioFormat.BEST
    if mode is Mode.VIDEO_ONLY:
        return False

    selector = build_format_selector(mode, resolution)
    opts = {**BASE_YDL_OPTS, "format": selector}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        raise ProbeError(str(exc)) from exc

    if info.get("requested_formats"):
        return len(info["requested_formats"]) > 1
    acodec = info.get("acodec")
    vcodec = info.get("vcodec")
    return not (acodec not in (None, "none") and vcodec not in (None, "none"))


def _quality_tag(job: JobRecord) -> str:
    if job.mode is Mode.AUDIO_ONLY:
        return f"audio-{job.audio_format.value}"
    return f"{job.mode.value}-{job.resolution}"


def build_ydl_opts(
    job: JobRecord,
    output_dir: Path,
    progress_hook: Callable,
    postprocessor_hook: Callable,
) -> dict:
    ffmpeg_path = find_ffmpeg()
    tag = _quality_tag(job)
    opts: dict = {
        **BASE_YDL_OPTS,
        "skip_download": False,
        # tag disambiguates output files across different mode/resolution jobs for
        # the same video, so one job never silently reuses another's downloaded file.
        "outtmpl": str(output_dir / f"%(title).120B [%(id)s] ({tag}).%(ext)s"),
        "format": build_format_selector(job.mode, job.resolution),
        "format_sort": ["res", "ext:mp4:m4a"],
        "progress_hooks": [progress_hook],
        "postprocessor_hooks": [postprocessor_hook],
        "postprocessors": [],
        "windowsfilenames": True,
        "noplaylist": True,
    }
    if ffmpeg_path:
        opts["ffmpeg_location"] = ffmpeg_path

    if job.mode is Mode.VIDEO_AUDIO:
        opts["merge_output_format"] = "mp4"

    if job.mode is Mode.AUDIO_ONLY and job.audio_format is not AudioFormat.BEST:
        opts["postprocessors"].append(
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": job.audio_format.value,
                "preferredquality": "192",
            }
        )

    return opts


def download(job: JobRecord, output_dir: Path, progress_hook: Callable, postprocessor_hook: Callable) -> None:
    opts = build_ydl_opts(job, output_dir, progress_hook, postprocessor_hook)
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([job.url])
