import { getPythonServiceUrl } from "@/lib/spotify-auth"

export type AnalyzeSong = {
  spotify_id: string | null
  spotify_uri: string | null
  title: string | null
  artist: string | null
  label: string | null
}

export type AnalyzeResult = {
  playlist_url: string
  playlist_id: string
  playlist_name: string
  songs: AnalyzeSong[]
  chunks_processed: number
  audd_requests: number
}

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
