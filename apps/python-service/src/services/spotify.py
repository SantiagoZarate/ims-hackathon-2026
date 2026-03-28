"""Spotify Web API: current user, create playlist, add tracks."""

from __future__ import annotations

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
    user_id: str,
    access_token: str,
    name: str,
    *,
    description: str = "",
    public: bool = False,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": name,
        "description": description,
        "public": public,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{SPOTIFY_API}/users/{user_id}/playlists",
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
                f"{SPOTIFY_API}/playlists/{playlist_id}/tracks",
                headers=headers,
                json={"uris": batch},
            )
            if r.status_code >= 400:
                logger.error("[spotify] Add tracks error: %s %s", r.status_code, r.text)
            r.raise_for_status()
    logger.info("[spotify] Successfully added all tracks")
