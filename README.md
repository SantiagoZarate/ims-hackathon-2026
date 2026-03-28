# ims-hackathon-2

Turborepo monorepo: Next.js frontend and Python (FastAPI) service for **YouTube → Spotify** playlists (AudD + yt-dlp).

## Structure

- `apps/web` — Next.js 16 (App Router), shadcn/ui, Tailwind v4, Spotify PKCE login
- `apps/python-service` — FastAPI: download audio, AudD recognition, create Spotify playlist

## Prerequisites

- [pnpm](https://pnpm.io)
- [uv](https://docs.astral.sh/uv/) (Python 3.12+)
- **ffmpeg** (required by pydub): `brew install ffmpeg`
- **Spotify app** — [Developer Dashboard](https://developer.spotify.com/dashboard): add redirect URI `http://localhost:3000/callback` (must match `.env.local`).
- **AudD** — API token from [dashboard.audd.io](https://dashboard.audd.io)

## Environment

1. **Web** — copy [`apps/web/.env.example`](apps/web/.env.example) to `apps/web/.env.local` and fill in values.
2. **API** — copy [`apps/python-service/.env.example`](apps/python-service/.env.example) to `apps/python-service/.env` and set `AUDD_API_TOKEN` and `CORS_ORIGINS`.

## Run locally

**Terminal 1 — Next.js**

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**Terminal 2 — Python API**

```bash
cd apps/python-service
uv sync
uv run uvicorn main:app --app-dir src --reload --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/health`

## Flow

1. Log in with Spotify on the web app.
2. Paste a YouTube URL and submit.
3. The API downloads audio, sends chunks to AudD, deduplicates tracks, and creates a **private** playlist on your account.
4. Use **Open in Spotify** on the result page.

## Other commands

```bash
pnpm build
pnpm lint
pnpm typecheck
```

### shadcn components

From `apps/web`:

```bash
cd apps/web && pnpm exec shadcn@latest add button
```

## Notes

- `yt-dlp` use may violate YouTube ToS — personal / hackathon use only.
- AudD standard recognition bills per request; long videos mean many chunks (see `CHUNK_LENGTH_MS` in `apps/python-service/src/services/youtube.py`).
