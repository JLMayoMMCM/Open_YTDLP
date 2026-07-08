from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import ProbeRequest, ProbeResponse
from app.ytdlp_service import ProbeError, probe as probe_url

router = APIRouter()


@router.post("/probe", response_model=ProbeResponse)
def probe(req: ProbeRequest) -> ProbeResponse:
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="Please enter a URL.")
    try:
        return probe_url(req.url.strip())
    except ProbeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read that URL: {exc}") from exc
