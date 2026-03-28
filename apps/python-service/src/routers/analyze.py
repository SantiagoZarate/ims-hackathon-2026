"""POST /analyze — YouTube URL to Spotify playlist (batch + SSE streaming)."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config import get_audd_api_token
from services import recognition, spotify, youtube

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analyze"])


class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=4)
    spotify_token: str = Field(..., min_length=10)


class SongOut(BaseModel):
    spotify_id: str | None = None
    spotify_uri: str | None = None
    title: str | None = None
    artist: str | None = None
    label: str | None = None
    image_url: str | None = None


class AnalyzeResponse(BaseModel):
    playlist_url: str
    playlist_id: str
    playlist_name: str
    songs: list[SongOut]
    chunks_processed: int
    audd_requests: int


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    audd_token = get_audd_api_token()
    if not audd_token:
        raise HTTPException(
            status_code=500,
            detail="Server missing AUDD_API_TOKEN. Copy apps/python-service/.env.example to .env.",
        )

    if not youtube.is_youtube_url(body.url):
        raise HTTPException(status_code=400, detail="Not a valid YouTube URL")

    logger.info("[analyze] Request for URL: %s", body.url)
    t_start = time.monotonic()

    work_dir = youtube.make_audio_store()
    logger.info("[analyze] Step 1/4 — downloading audio…")
    try:
        mp3_path, video_title = await asyncio.to_thread(
            youtube.download_audio_mp3, body.url, work_dir
        )
    except Exception as e:
        logger.exception("[analyze] yt-dlp download failed")
        raise HTTPException(
            status_code=422,
            detail=f"Could not download audio: {e!s}",
        ) from e

    logger.info("[analyze] Step 2/4 — chunking audio…")
    try:
        chunks = await asyncio.to_thread(youtube.split_audio_to_chunks, mp3_path)
    except Exception as e:
        logger.exception("[analyze] audio chunking failed")
        raise HTTPException(
            status_code=422,
            detail=f"Could not process audio (is ffmpeg installed?): {e!s}",
        ) from e

    logger.info("[analyze] Step 3/4 — recognizing %d chunk(s) via AudD…", len(chunks))
    songs_raw, audd_requests = await recognition.recognize_chunks(
        chunks, audd_token
    )

    logger.info("[analyze] Step 4/4 — creating Spotify playlist…")
    try:
        await spotify.get_current_user(body.spotify_token)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="Spotify token invalid or expired. Log in again.",
            ) from e
        raise HTTPException(
            status_code=502,
            detail=f"Spotify /me failed: {e.response.text[:300]}",
        ) from e
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Spotify request failed: {e!s}",
        ) from e

    playlist_name = spotify.sanitize_playlist_name(video_title)
    description = "Created from a YouTube video (hackathon MVP)."

    try:
        pl = await spotify.create_playlist(
            body.spotify_token,
            playlist_name,
            description=description,
            public=False,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not create playlist: {e.response.text[:300]}",
        ) from e

    playlist_id = pl.get("id") or ""
    ext = pl.get("external_urls") or {}
    playlist_url = ext.get("spotify") or f"https://open.spotify.com/playlist/{playlist_id}"

    uris = [s["spotify_uri"] for s in songs_raw if s.get("spotify_uri")]
    track_ids = [s["spotify_id"] for s in songs_raw if s.get("spotify_id")]

    add_tracks_task = spotify.add_tracks_to_playlist(
        playlist_id, body.spotify_token, uris
    )
    image_urls_task = spotify.get_tracks_image_urls(track_ids, body.spotify_token)

    try:
        _, image_urls = await asyncio.gather(add_tracks_task, image_urls_task)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Playlist created but adding tracks failed: {e.response.text[:300]}",
        ) from e

    songs = [
        SongOut(
            spotify_id=s.get("spotify_id"),
            spotify_uri=s.get("spotify_uri"),
            title=s.get("title"),
            artist=s.get("artist"),
            label=s.get("label"),
            image_url=image_urls.get(s["spotify_id"]) if s.get("spotify_id") else None,
        )
        for s in songs_raw
    ]

    elapsed = time.monotonic() - t_start
    logger.info(
        "[analyze] Done in %.1fs — %d song(s), playlist: %s",
        elapsed,
        len(songs),
        playlist_url,
    )

    return AnalyzeResponse(
        playlist_url=playlist_url,
        playlist_id=playlist_id,
        playlist_name=playlist_name,
        songs=songs,
        chunks_processed=len(chunks),
        audd_requests=audd_requests,
    )


# ---------------------------------------------------------------------------
# SSE streaming endpoint
# ---------------------------------------------------------------------------

def _sse(data: dict) -> str:  # noqa: ANN001
    return f"data: {json.dumps(data)}\n\n"


@router.post("/analyze/stream")
async def analyze_stream(body: AnalyzeRequest) -> StreamingResponse:
    """
    Same pipeline as /analyze but streams Server-Sent Events so the frontend
    can show songs as they are recognized rather than waiting for everything.

    Events emitted:
      {"type": "progress", "step": str, "message": str, "total_chunks"?: int}
      {"type": "song",     "chunk": int, "total": int, ...song fields...}
      {"type": "chunk_done","chunk": int, "total": int}
      {"type": "done",     "playlist_url": str, "playlist_id": str,
                           "playlist_name": str, "chunks_processed": int,
                           "audd_requests": int}
      {"type": "error",    "message": str}
    """
    audd_token = get_audd_api_token()
    if not audd_token:
        raise HTTPException(
            status_code=500,
            detail="Server missing AUDD_API_TOKEN.",
        )
    if not youtube.is_youtube_url(body.url):
        raise HTTPException(status_code=400, detail="Not a valid YouTube URL")

    async def generate() -> AsyncGenerator[str, None]:
        t_start = time.monotonic()
        try:
            # ── Step 1: download ──────────────────────────────────────────
            yield _sse({"type": "progress", "step": "downloading",
                        "message": "Downloading audio…"})
            work_dir = youtube.make_audio_store()
            try:
                mp3_path, video_title = await asyncio.to_thread(
                    youtube.download_audio_mp3, body.url, work_dir
                )
            except Exception as e:
                logger.exception("[analyze/stream] yt-dlp failed")
                yield _sse({"type": "error", "message": f"Could not download audio: {e!s}"})
                return

            # ── Step 2: chunk ─────────────────────────────────────────────
            yield _sse({"type": "progress", "step": "chunking",
                        "message": "Splitting audio into chunks…"})
            try:
                chunks = await asyncio.to_thread(youtube.split_audio_to_chunks, mp3_path)
            except Exception as e:
                logger.exception("[analyze/stream] chunking failed")
                yield _sse({"type": "error",
                            "message": f"Could not process audio (is ffmpeg installed?): {e!s}"})
                return

            yield _sse({"type": "progress", "step": "recognizing",
                        "message": f"Recognizing {len(chunks)} chunk(s)…",
                        "total_chunks": len(chunks)})

            # ── Step 3: recognize + fetch image per song ──────────────────
            songs_raw: list[dict] = []
            audd_requests = 0
            async for event in recognition.recognize_chunks_stream(chunks, audd_token):
                audd_requests = event["requests_made"]
                if event["type"] == "song":
                    song: dict = event["song"]
                    image_url = await spotify.get_single_track_image_url(
                        song["spotify_id"], body.spotify_token
                    )
                    song["image_url"] = image_url
                    songs_raw.append(song)
                    yield _sse({
                        "type": "song",
                        "chunk": event["chunk"],
                        "total": event["total"],
                        **song,
                    })
                else:
                    yield _sse({"type": "chunk_done",
                                "chunk": event["chunk"],
                                "total": event["total"]})

            # ── Step 4: create playlist ───────────────────────────────────
            yield _sse({"type": "progress", "step": "playlist",
                        "message": "Creating Spotify playlist…"})

            try:
                await spotify.get_current_user(body.spotify_token)
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                msg = "Spotify token invalid or expired." if status == 401 else \
                      f"Spotify /me failed: {e.response.text[:200]}"
                yield _sse({"type": "error", "message": msg})
                return
            except httpx.RequestError as e:
                yield _sse({"type": "error", "message": f"Spotify request failed: {e!s}"})
                return

            playlist_name = spotify.sanitize_playlist_name(video_title)
            description = "Created from a YouTube video (hackathon MVP)."
            try:
                pl = await spotify.create_playlist(
                    body.spotify_token, playlist_name,
                    description=description, public=False,
                )
            except httpx.HTTPStatusError as e:
                yield _sse({"type": "error",
                            "message": f"Could not create playlist: {e.response.text[:200]}"})
                return

            playlist_id = pl.get("id") or ""
            ext = pl.get("external_urls") or {}
            playlist_url = (ext.get("spotify") or
                            f"https://open.spotify.com/playlist/{playlist_id}")

            uris = [s["spotify_uri"] for s in songs_raw if s.get("spotify_uri")]
            try:
                await spotify.add_tracks_to_playlist(playlist_id, body.spotify_token, uris)
            except httpx.HTTPStatusError as e:
                yield _sse({"type": "error",
                            "message": f"Playlist created but adding tracks failed: "
                                       f"{e.response.text[:200]}"})
                return

            elapsed = time.monotonic() - t_start
            logger.info(
                "[analyze/stream] Done in %.1fs — %d song(s), playlist: %s",
                elapsed, len(songs_raw), playlist_url,
            )
            yield _sse({
                "type": "done",
                "playlist_url": playlist_url,
                "playlist_id": playlist_id,
                "playlist_name": playlist_name,
                "chunks_processed": len(chunks),
                "audd_requests": audd_requests,
            })

        except Exception as e:
            logger.exception("[analyze/stream] Unhandled error")
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
