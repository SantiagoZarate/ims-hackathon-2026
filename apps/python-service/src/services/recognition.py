"""Send audio chunks to AudD and collect unique Spotify track IDs."""

from __future__ import annotations

import io
import logging
from typing import Any

import httpx
from pydub import AudioSegment

AUDD_URL = "https://api.audd.io/"
logger = logging.getLogger(__name__)


def _extract_spotify_from_result(result: Any) -> tuple[str | None, str | None, str | None]:
    """
    Returns (spotify_id, spotify_uri, display label).
    AudD nests provider data under result['spotify'] for return=spotify.
    """
    if not isinstance(result, dict):
        return None, None, None

    artist = result.get("artist")
    title = result.get("title")
    label = None
    if artist and title:
        label = f"{artist} — {title}"
    elif title:
        label = str(title)

    spotify = result.get("spotify")
    if not isinstance(spotify, dict):
        return None, None, label

    uri = spotify.get("uri")
    if isinstance(uri, str) and uri.startswith("spotify:track:"):
        tid = uri.split(":")[-1]
        return tid, uri, label

    tid = spotify.get("id")
    if isinstance(tid, str) and tid:
        return tid, f"spotify:track:{tid}", label

    return None, None, label


async def recognize_chunks(
    chunks: list[AudioSegment],
    api_token: str,
    *,
    timeout: float = 60.0,
) -> tuple[list[dict[str, str | None]], int]:
    """
    Send each chunk to AudD. Returns (list of song dicts with unique spotify ids, request count).
    """
    songs_by_id: dict[str, dict[str, str | None]] = {}
    requests_made = 0
    total = len(chunks)

    async with httpx.AsyncClient(timeout=timeout) as client:
        for i, segment in enumerate(chunks):
            logger.info("[recognition] Chunk %d/%d → sending to AudD", i + 1, total)
            buf = io.BytesIO()
            segment.export(buf, format="mp3")
            buf.seek(0)
            file_bytes = buf.read()
            data = {
                "api_token": api_token,
                "return": "spotify",
            }
            files = {
                "file": (f"chunk_{i}.mp3", file_bytes, "audio/mpeg"),
            }
            try:
                resp = await client.post(AUDD_URL, data=data, files=files)
                resp.raise_for_status()
                payload = resp.json()
            except Exception as e:
                logger.warning("[recognition] Chunk %d → AudD request failed: %s", i + 1, e)
                requests_made += 1
                continue

            requests_made += 1
            status = payload.get("status")
            if status != "success":
                logger.debug("[recognition] Chunk %d → non-success response: %s", i + 1, payload)
                continue

            result = payload.get("result")
            if result is None:
                logger.info("[recognition] Chunk %d → no match", i + 1)
                continue

            tid, uri, label = _extract_spotify_from_result(result)
            if not tid or not uri:
                logger.info("[recognition] Chunk %d → matched but no Spotify ID", i + 1)
                continue
            if tid not in songs_by_id:
                logger.info("[recognition] Chunk %d → new match: %s", i + 1, label)
                songs_by_id[tid] = {
                    "spotify_id": tid,
                    "spotify_uri": uri,
                    "title": None,
                    "artist": None,
                    "label": label,
                }
                if isinstance(result, dict):
                    songs_by_id[tid]["title"] = result.get("title")
                    songs_by_id[tid]["artist"] = result.get("artist")
            else:
                logger.info("[recognition] Chunk %d → duplicate (already have %s)", i + 1, label)

    logger.info(
        "[recognition] Done: %d unique song(s) from %d request(s)",
        len(songs_by_id),
        requests_made,
    )
    return list(songs_by_id.values()), requests_made
