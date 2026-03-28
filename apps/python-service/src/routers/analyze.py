"""POST /analyze — YouTube URL to Spotify playlist."""

from __future__ import annotations

import asyncio
import logging
import time

import httpx
from fastapi import APIRouter, HTTPException
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
    try:
        await spotify.add_tracks_to_playlist(
            playlist_id, body.spotify_token, uris
        )
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
