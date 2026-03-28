"""Download YouTube audio with yt-dlp and split into chunks for AudD."""

from __future__ import annotations

import re
import shutil
import tempfile
from pathlib import Path

import logging

import yt_dlp
from pydub import AudioSegment

logger = logging.getLogger(__name__)

# AudD standard recognition: max ~25s; docs recommend ≤20s.
CHUNK_LENGTH_MS = 15_000
MIN_CHUNK_MS = 3_000

_YT_HOST = re.compile(
    r"(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$",
    re.IGNORECASE,
)


def is_youtube_url(url: str) -> bool:
    from urllib.parse import urlparse

    try:
        parsed = urlparse(url.strip())
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    return bool(_YT_HOST.search(host))


def download_audio_mp3(url: str, work_dir: Path) -> tuple[Path, str]:
    """
    Download best audio and extract to MP3. Returns (path to mp3, video title).
    """
    logger.info("[youtube] Downloading audio from %s", url)
    work_dir.mkdir(parents=True, exist_ok=True)
    out_template = str(work_dir / "%(id)s.%(ext)s")
    ydl_opts: dict = {
        "format": "bestaudio/best",
        "outtmpl": out_template,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }
    info: dict | None = None
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    if not info:
        raise RuntimeError("yt-dlp returned no metadata")

    title = (info.get("title") or "YouTube playlist").strip()
    vid = info.get("id")
    mp3_path = work_dir / f"{vid}.mp3" if vid else None
    if mp3_path and mp3_path.is_file():
        logger.info("[youtube] Downloaded mp3: %s", mp3_path)
        return mp3_path, title

    mp3s = sorted(work_dir.glob("*.mp3"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not mp3s:
        raise RuntimeError("No MP3 file produced after download")
    found = mp3s[0]
    logger.info("[youtube] Downloaded mp3: %s", found)
    return found, title


def split_audio_to_chunks(mp3_path: Path, chunk_ms: int = CHUNK_LENGTH_MS) -> list[AudioSegment]:
    audio = AudioSegment.from_mp3(str(mp3_path))
    duration_s = len(audio) / 1000
    logger.info("[youtube] Audio duration: %.1fs", duration_s)
    chunks: list[AudioSegment] = []
    for start in range(0, len(audio), chunk_ms):
        chunk = audio[start : start + chunk_ms]
        if len(chunk) < MIN_CHUNK_MS:
            break
        chunks.append(chunk)
    logger.info("[youtube] Split into %d chunk(s) of ~%ds", len(chunks), chunk_ms // 1000)
    return chunks


def make_temp_workdir() -> Path:
    return Path(tempfile.mkdtemp(prefix="yt2spotify_"))


def cleanup_workdir(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
