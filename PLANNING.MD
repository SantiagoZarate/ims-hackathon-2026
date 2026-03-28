# MVP Plan — YouTube to Spotify Playlist

## Stack
- **Backend:** Python + FastAPI
- **Frontend:** Plain HTML/CSS/JS
- **Audio recognition:** ACRCloud (free tier, 1k req/month)
- **Downloader:** yt-dlp
- **Playlist:** Spotify Web API

---

## Phase 1 — Setup
- [ ] Register app on [Spotify Developer Dashboard](https://developer.spotify.com)
  - Enable `playlist-modify-public` and `playlist-modify-private` scopes
  - Set redirect URI (e.g. `http://localhost:8000/callback`)
- [ ] Create account on [ACRCloud](https://www.acrcloud.com) and get API credentials
- [ ] Install dependencies: `yt-dlp`, `fastapi`, `uvicorn`, `requests`, `acrcloud-sdk`

---

## Phase 2 — Backend

### Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/login` | Redirect user to Spotify OAuth |
| GET | `/callback` | Handle Spotify token exchange |
| POST | `/analyze` | Main flow: receive URL, return playlist link |

### `/analyze` flow
1. Receive YouTube URL
2. Download audio with `yt-dlp` (mp3, audio-only)
3. Split audio into 10–20s chunks (ACRCloud works best on short clips)
4. Send each chunk to ACRCloud → collect matched songs (deduplicated)
5. Search each song on Spotify → collect track URIs
6. Create Spotify playlist → add tracks
7. Return playlist URL to frontend

---

## Phase 3 — Frontend
- Single page: URL input + submit button
- Show loading state while processing
- Display result as a "Open in Spotify" link

---

## Phase 4 — Local network access (Mac + iPhone)
- Run server on `0.0.0.0:8000`
- Find your Mac's local IP (`ifconfig | grep 192`)
- Access from iPhone at `http://192.168.x.x:8000`
- Both devices must be on the same Wi-Fi

---

## Known Limitations (MVP)
- `yt-dlp` violates YouTube ToS — personal use only
- ACRCloud may miss songs with low audio presence (background music, short clips)
- Spotify OAuth token expires — no refresh logic needed for MVP
- Long videos (1h+) will take time to process — no progress bar needed for MVP