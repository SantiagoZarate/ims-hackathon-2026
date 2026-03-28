"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { analyzeYoutube, type AnalyzeResult } from "@/lib/api"
import {
  beginSpotifyLogin,
  clearSpotifySession,
  getStoredAccessToken,
} from "@/lib/spotify-auth"

export function HomePage() {
  const searchParams = useSearchParams()
  const [token, setToken] = useState<string | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)

  useEffect(() => {
    const stored = getStoredAccessToken()
    if (stored) {
      console.log("[page] Spotify token found in sessionStorage")
    } else {
      console.log("[page] No Spotify token in sessionStorage — user not logged in")
    }
    setToken(stored)
    const se = searchParams.get("spotify_error")
    if (se) {
      setError(decodeURIComponent(se))
      window.history.replaceState(null, "", "/")
    }
  }, [searchParams])

  const handleLogin = useCallback(async () => {
    setError(null)
    try {
      await beginSpotifyLogin()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Spotify login")
    }
  }, [])

  const handleLogout = useCallback(() => {
    clearSpotifySession()
    setToken(null)
    setResult(null)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!token) {
        setError("Log in with Spotify first.")
        return
      }
      setError(null)
      setResult(null)
      setLoading(true)
      console.log("[page] Submitting URL:", youtubeUrl)
      try {
        const data = await analyzeYoutube(youtubeUrl, token)
        setResult(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    },
    [token, youtubeUrl]
  )

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-2xl flex-col items-center gap-10 text-center">
        <div className="space-y-2">
          <p className="font-heading text-balance text-2xl font-medium tracking-tight sm:text-3xl">
            Paste a YouTube URL, get a Spotify playlist
          </p>
          <p className="text-balance text-sm text-muted-foreground sm:text-base">
            We recognize the songs in the audio and add only those tracks to a
            new playlist on your account.
          </p>
        </div>

        {!token ? (
          <div className="w-full max-w-md space-y-3 rounded-none border border-border bg-card p-5 text-left">
            <p className="text-sm">Connect Spotify to create playlists.</p>
            <Button type="button" onClick={handleLogin} className="w-full sm:w-auto">
              Log in with Spotify
            </Button>
          </div>
        ) : (
          <div className="flex w-full max-w-md items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Spotify connected</span>
            <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col items-center gap-4"
        >
          <label className="sr-only" htmlFor="youtube-url">
            YouTube URL
          </label>
          <Input
            id="youtube-url"
            name="youtube-url"
            type="url"
            required
            placeholder="https://www.youtube.com/watch?v=…"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            disabled={loading || !token}
            className="h-auto min-h-14 w-full max-w-2xl px-5 py-4 text-base placeholder:text-muted-foreground/70 sm:min-h-16 sm:text-xl md:text-2xl md:py-5"
          />
          <Button
            type="submit"
            size="lg"
            disabled={loading || !token}
            className="min-w-48"
          >
            {loading ? "Working… (this can take a while)" : "Create playlist"}
          </Button>
        </form>

        {error ? (
          <p className="max-w-lg text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="w-full max-w-2xl space-y-4 rounded-none border border-border bg-card p-5 text-left">
            <div>
              <h2 className="font-heading text-sm font-medium">
                {result.playlist_name}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.songs.length} unique track(s) · {result.chunks_processed}{" "}
                audio chunk(s) · {result.audd_requests} AudD request(s)
              </p>
              <Link
                href={result.playlist_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: "sm" }), "mt-3 inline-flex")}
              >
                Open in Spotify
              </Link>
            </div>
            {result.songs.length > 0 ? (
              <ul className="max-h-60 space-y-2 overflow-y-auto text-xs">
                {result.songs.map((s) => (
                  <li key={s.spotify_id ?? s.spotify_uri ?? s.label}>
                    <span className="font-medium">
                      {s.artist && s.title
                        ? `${s.artist} — ${s.title}`
                        : (s.label ?? s.title ?? "Unknown track")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No songs were recognized. Try a different video or shorter
                clips.
              </p>
            )}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground font-mono">
          Press <kbd className="px-1">d</kbd> for dark mode
        </p>
      </div>
    </main>
  )
}
