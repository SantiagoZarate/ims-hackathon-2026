import type { AnalyzeSong } from "@/lib/api"

const STORAGE_KEY = "yt2spotify_history"
const MAX_ENTRIES = 50

export type SavedPlaylist = {
  id: string
  name: string
  url: string
  youtube_url: string
  songs: AnalyzeSong[]
  created_at: string
}

function parseHistory(raw: string | null): SavedPlaylist[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is SavedPlaylist =>
        e != null &&
        typeof e === "object" &&
        typeof (e as SavedPlaylist).id === "string" &&
        typeof (e as SavedPlaylist).name === "string" &&
        typeof (e as SavedPlaylist).url === "string" &&
        typeof (e as SavedPlaylist).youtube_url === "string" &&
        Array.isArray((e as SavedPlaylist).songs) &&
        typeof (e as SavedPlaylist).created_at === "string"
    )
  } catch {
    return []
  }
}

export function getHistory(): SavedPlaylist[] {
  if (typeof window === "undefined") return []
  return parseHistory(window.localStorage.getItem(STORAGE_KEY))
}

export function savePlaylist(entry: SavedPlaylist): void {
  if (typeof window === "undefined") return
  const existing = getHistory()
  const withoutDup = existing.filter((p) => p.id !== entry.id)
  const next = [entry, ...withoutDup].slice(0, MAX_ENTRIES)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function deletePlaylist(id: string): SavedPlaylist[] {
  const next = getHistory().filter((p) => p.id !== id)
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

export function clearHistory(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}
