if (-not (Test-Path .venv)) {
    py -3 -m venv .venv
}
. .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
