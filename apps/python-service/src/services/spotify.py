"""Spotify Web API: current user, create playlist, add tracks, fetch track metadata."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

SPOTIFY_API = "https://api.spotify.com/v1"
logger = logging.getLogger(__name__)


def _bearer(access_token: str) -> dict[str, str]:
    token = access_token.strip()
    if not token.lower().startswith("bearer "):
        token = f"Bearer {token}"
    return {"Authorization": token}


async def get_current_user(access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{SPOTIFY_API}/me",
            headers=_bearer(access_token),
        )
        r.raise_for_status()
        data = r.json()
        logger.info("[spotify] Fetched current user: %s (%s)", data.get("id"), data.get("display_name"))
        return data


def sanitize_playlist_name(title: str, max_len: int = 100) -> str:
    cleaned = " ".join(title.split())
    if len(cleaned) <= max_len:
        return cleaned or "YouTube mix"
    return cleaned[: max_len - 1].rstrip() + "…"


async def create_playlist(
    access_token: str,
    name: str,
    *,
    description: str = "",
    public: bool = False,
) -> dict[str, Any]:
    """Create a playlist for the current user (POST /me/playlists — Feb 2026+ API)."""
    body: dict[str, Any] = {
        "name": name,
        "description": description,
        "public": public,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{SPOTIFY_API}/me/playlists",
            headers=_bearer(access_token),
            json=body,
        )
        r.raise_for_status()
        data = r.json()
        logger.info("[spotify] Created playlist '%s' (id=%s)", name, data.get("id"))
        return data


async def add_tracks_to_playlist(
    playlist_id: str,
    access_token: str,
    track_uris: list[str],
) -> None:
    if not track_uris:
        logger.info("[spotify] No tracks to add — skipping")
        return

    logger.info("[spotify] Adding %d track(s) to playlist %s", len(track_uris), playlist_id)
    headers = _bearer(access_token)
    async with httpx.AsyncClient(timeout=60.0) as client:
        for offset in range(0, len(track_uris), 100):
            batch = track_uris[offset : offset + 100]
            r = await client.post(
                f"{SPOTIFY_API}/playlists/{playlist_id}/items",
                headers=headers,
                json={"uris": batch},
            )
            if r.status_code >= 400:
                logger.error("[spotify] Add tracks error: %s %s", r.status_code, r.text)
            r.raise_for_status()
    logger.info("[spotify] Successfully added all tracks")


def _pick_image_url(data: dict[str, Any]) -> str | None:
    """Return the smallest available album art URL from a track object."""
    try:
        images: list[dict[str, Any]] = data["album"]["images"]
        if not images:
            return None
        # images are sorted largest → smallest; pick the smallest (last)
        return str(images[-1]["url"])
    except (KeyError, IndexError, TypeError):
        return None


async def _fetch_track_image(
    client: httpx.AsyncClient,
    track_id: str,
    headers: dict[str, str],
) -> tuple[str, str | None]:
    """Fetch a single track and return (track_id, image_url)."""
    try:
        r = await client.get(f"{SPOTIFY_API}/tracks/{track_id}", headers=headers)
        if r.status_code == 200:
            return track_id, _pick_image_url(r.json())
        logger.warning("[spotify] Track %s metadata returned %s", track_id, r.status_code)
    except Exception as e:
        logger.warning("[spotify] Failed to fetch track %s: %s", track_id, e)
    return track_id, None


async def get_single_track_image_url(track_id: str, access_token: str) -> str | None:
    """Fetch album art for a single track (used in SSE streaming flow)."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        _, url = await _fetch_track_image(client, track_id, _bearer(access_token))
        return url


async def get_tracks_image_urls(
    track_ids: list[str],
    access_token: str,
) -> dict[str, str | None]:
    """
    Fetch album art for up to N tracks in parallel.
    Returns {track_id: image_url} (url may be None on failure).
    """
    if not track_ids:
        return {}
    headers = _bearer(access_token)
    async with httpx.AsyncClient(timeout=15.0) as client:
        results = await asyncio.gather(
            *[_fetch_track_image(client, tid, headers) for tid in track_ids],
            return_exceptions=False,
        )
    mapping = {tid: url for tid, url in results}
    logger.info(
        "[spotify] Fetched album art for %d/%d track(s)",
        sum(1 for url in mapping.values() if url),
        len(track_ids),
    )
    return mapping
