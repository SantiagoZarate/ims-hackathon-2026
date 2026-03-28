import { getPythonServiceUrl } from "@/lib/spotify-auth"

export type AnalyzeSong = {
  spotify_id: string | null
  spotify_uri: string | null
  title: string | null
  artist: string | null
  label: string | null
  image_url: string | null
}

export type AnalyzeResult = {
  playlist_url: string
  playlist_id: string
  playlist_name: string
  songs: AnalyzeSong[]
  chunks_processed: number
  audd_requests: number
}

// ── SSE event types ────────────────────────────────────────────────────────

export type SseProgressEvent = {
  type: "progress"
  step: "downloading" | "chunking" | "recognizing" | "playlist"
  message: string
  total_chunks?: number
}

export type SseSongEvent = {
  type: "song"
  chunk: number
  total: number
} & AnalyzeSong

export type SseChunkDoneEvent = {
  type: "chunk_done"
  chunk: number
  total: number
}

export type SseDoneEvent = {
  type: "done"
  playlist_url: string
  playlist_id: string
  playlist_name: string
  chunks_processed: number
  audd_requests: number
}

export type SseErrorEvent = {
  type: "error"
  message: string
}

export type SseEvent =
  | SseProgressEvent
  | SseSongEvent
  | SseChunkDoneEvent
  | SseDoneEvent
  | SseErrorEvent

function formatFastApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) =>
        typeof d === "object" && d && "msg" in d
          ? String((d as { msg: string }).msg)
          : JSON.stringify(d)
      )
      .join("; ")
  }
  if (detail && typeof detail === "object") {
    return JSON.stringify(detail)
  }
  return "Request failed"
}

export async function analyzeYoutube(
  url: string,
  spotifyAccessToken: string
): Promise<AnalyzeResult> {
  const base = getPythonServiceUrl()
  console.log("[api] POST /analyze →", base, "| url:", url.trim())
  const t0 = performance.now()

  const res = await fetch(`${base}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url.trim(),
      spotify_token: spotifyAccessToken,
    }),
  })

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`[api] /analyze responded ${res.status} in ${elapsed}s`)

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (body.detail !== undefined) {
        message = formatFastApiDetail(body.detail)
      }
    } catch {
      /* keep status text */
    }
    console.error("[api] /analyze error:", message)
    throw new Error(message)
  }

  const data = (await res.json()) as AnalyzeResult
  console.log(
    `[api] /analyze success — ${data.songs.length} song(s) | ${data.chunks_processed} chunk(s) | ${data.audd_requests} AudD request(s)`,
    "\n[api] Playlist:", data.playlist_url
  )
  return data
}

export async function analyzeYoutubeStream(
  url: string,
  spotifyAccessToken: string,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  const base = getPythonServiceUrl()
  console.log("[api] POST /analyze/stream →", base, "| url:", url.trim())
  const t0 = performance.now()

  const res = await fetch(`${base}/analyze/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url.trim(), spotify_token: spotifyAccessToken }),
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (body.detail !== undefined) message = formatFastApiDetail(body.detail)
    } catch { /* keep status text */ }
    throw new Error(message)
  }

  if (!res.body) throw new Error("No response body from /analyze/stream")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE events are separated by \n\n
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""

      for (const part of parts) {
        const dataLine = part.split("\n").find((l) => l.startsWith("data: "))
        if (!dataLine) continue
        try {
          const event = JSON.parse(dataLine.slice(6)) as SseEvent
          onEvent(event)
        } catch {
          // malformed line — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
    console.log(`[api] /analyze/stream finished in ${elapsed}s`)
  }
}
