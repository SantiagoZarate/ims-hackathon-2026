# python-service

FastAPI backend: **YouTube audio → AudD → Spotify playlist**.

## Setup

1. Install **ffmpeg** (`brew install ffmpeg` on macOS).
2. Copy `.env.example` to `.env` and set `AUDD_API_TOKEN` (and `CORS_ORIGINS` if the web app is not on `http://localhost:3000`).

```bash
uv sync
uv run uvicorn main:app --app-dir src --reload --host 0.0.0.0 --port 8000
```

The `--app-dir src` flag is required so imports like `routers.analyze` resolve.

## Endpoints

- `GET /health` — liveness
- `POST /analyze` — body: `{ "url": "<youtube>", "spotify_token": "<user access token>" }`

## Dependencies

- `yt-dlp` — download
- `pydub` + ffmpeg — split MP3 into chunks for AudD
- `httpx` — AudD + Spotify Web API
