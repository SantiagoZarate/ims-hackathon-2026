"""Download YouTube audio with yt-dlp and split into chunks for AudD."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import logging

import yt_dlp
from pydub import AudioSegment

logger = logging.getLogger(__name__)

# Persisted MP3s under apps/python-service/audio_store/
AUDIO_STORE = Path(__file__).resolve().parent.parent.parent / "audio_store"

# AudD standard recognition: max ~25s; docs recommend ≤20s.
CHUNK_LENGTH_MS = 15_000
MIN_CHUNK_MS = 3_000

_YT_HOST = re.compile(
    r"(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$",
    re.IGNORECASE,
)


def is_youtube_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    return bool(_YT_HOST.search(host))


def extract_video_id(url: str) -> str | None:
    """Best-effort video ID from URL (for cache lookup before yt-dlp)."""
    try:
        p = urlparse(url.strip())
    except Exception:
        return None
    host = (p.hostname or "").lower()
    if not host:
        return None
    if "youtu.be" in host:
        seg = p.path.strip("/").split("/")
        return seg[0] if seg and seg[0] else None
    if "youtube.com" in host or "youtube-nocookie.com" in host:
        qs = parse_qs(p.query)
        if "v" in qs and qs["v"]:
            return qs["v"][0]
        parts = p.path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] in ("embed", "v", "shorts", "live"):
            return parts[1]
    return None


def make_audio_store() -> Path:
    AUDIO_STORE.mkdir(parents=True, exist_ok=True)
    return AUDIO_STORE


def _read_cached_title(work_dir: Path, vid: str) -> str:
    title_file = work_dir / f"{vid}.title.txt"
    if title_file.is_file():
        text = title_file.read_text(encoding="utf-8").strip()
        if text:
            return text
    return f"YouTube mix ({vid})"


def _write_title_sidecar(work_dir: Path, vid: str, title: str) -> None:
    try:
        (work_dir / f"{vid}.title.txt").write_text(title.strip(), encoding="utf-8")
    except OSError as e:
        logger.warning("[youtube] Could not write title sidecar: %s", e)


def download_audio_mp3(url: str, work_dir: Path) -> tuple[Path, str]:
    """
    Download best audio and extract to MP3. Returns (path to mp3, video title).
    Uses audio_store cache: skips download if {id}.mp3 already exists.
    """
    work_dir.mkdir(parents=True, exist_ok=True)

    vid_guess = extract_video_id(url)
    if vid_guess:
        cached = work_dir / f"{vid_guess}.mp3"
        if cached.is_file():
            title = _read_cached_title(work_dir, vid_guess)
            logger.info("[youtube] Cache hit: %s (title: %s)", cached, title[:60])
            return cached, title

    logger.info("[youtube] Downloading audio from %s", url)
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
    if isinstance(vid, str) and vid:
        _write_title_sidecar(work_dir, vid, title)

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
