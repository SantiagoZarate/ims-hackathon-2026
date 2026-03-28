"use client"

import { ArrowSquareOut } from "@phosphor-icons/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { PlatformLogos } from "@/components/platform-logos"
import { useSpotifySession } from "@/components/spotify-session-context"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { analyzeYoutube, type AnalyzeResult } from "@/lib/api"
import { getStoredAccessToken } from "@/lib/spotify-auth"
import { cn } from "@/lib/utils"

export function HomePage() {
  const searchParams = useSearchParams()
  const { token, authError, clearAuthError } = useSpotifySession()
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const stored = getStoredAccessToken()
    if (stored) {
      console.log("[page] Spotify token found in sessionStorage")
    } else {
      console.log("[page] No Spotify token in sessionStorage — user not logged in")
    }
    const se = searchParams.get("spotify_error")
    if (se) {
      setError(decodeURIComponent(se))
      window.history.replaceState(null, "", "/")
    }
  }, [searchParams])

  useEffect(() => {
    if (!token) {
      setResult(null)
      setDrawerOpen(false)
    }
  }, [token])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!token) {
        setError("Log in with Spotify first.")
        return
      }
      setError(null)
      clearAuthError()
      setResult(null)
      setDrawerOpen(false)
      setLoading(true)
      console.log("[page] Submitting URL:", youtubeUrl)
      try {
        const data = await analyzeYoutube(youtubeUrl, token)
        setResult(data)
        setDrawerOpen(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    },
    [token, youtubeUrl, clearAuthError]
  )

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-[805px] flex-col items-center gap-8 text-center">
        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col items-center gap-4"
        >
          <PlatformLogos className="-mb-1" />
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
            className="h-auto min-h-14 w-full max-w-2xl rounded-2xl px-5 py-4 text-base placeholder:text-muted-foreground/70 sm:min-h-16 sm:text-xl md:text-2xl md:py-5"
          />
          <Button
            type="submit"
            size="lg"
            disabled={loading || !token}
            className="min-w-48 rounded-xl px-6"
          >
            {loading ? "Working… (this can take a while)" : "Create playlist"}
          </Button>
        </form>

        <div className="space-y-1">
          <p className="font-heading text-balance text-xl font-medium tracking-tight sm:text-2xl">
            Paste a YouTube URL, get a Spotify playlist
          </p>
          <p className="text-balance text-sm text-muted-foreground">
            We recognize the songs in the audio and add only those tracks to a
            new playlist on your account.
          </p>
        </div>

        {error || authError ? (
          <p className="max-w-lg text-sm text-destructive" role="alert">
            {error ?? authError}
          </p>
        ) : null}

        {result ? (
          <Drawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            position="bottom"
          >
            <DrawerPopup showBar className="h-[min(90vh,720px)]">
              <DrawerHeader>
                <DrawerTitle>{result.playlist_name}</DrawerTitle>
                <DrawerDescription>
                  {result.songs.length} unique track(s) ·{" "}
                  {result.chunks_processed} audio chunk(s) ·{" "}
                  {result.audd_requests} AudD request(s)
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex min-h-0 max-h-[60vh] flex-1 flex-col px-6">
                <ScrollArea
                  scrollFade
                  className="min-h-0 flex-1 touch-auto [--fade-size:2rem]"
                >
                  {result.songs.length > 0 ? (
                    <ul className="space-y-3 pb-2 text-left text-sm">
                      {result.songs.map((s, i) => {
                        const line =
                          s.artist && s.title
                            ? `${s.artist} — ${s.title}`
                            : (s.label ?? s.title ?? "Unknown track")
                        const trackHref =
                          s.spotify_id != null
                            ? `https://open.spotify.com/track/${s.spotify_id}`
                            : null
                        return (
                          <li
                            key={`${s.spotify_id ?? s.spotify_uri ?? s.label ?? "t"}-${i}`}
                            className="flex items-start gap-2 border-b border-border/60 pb-3 last:border-0"
                          >
                            <span className="min-w-0 flex-1 font-medium leading-snug">
                              {line}
                            </span>
                            {trackHref ? (
                              <Link
                                href={trackHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`Open ${line} on Spotify`}
                              >
                                <ArrowSquareOut
                                  className="size-5 shrink-0"
                                  weight="bold"
                                />
                              </Link>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="pb-4 text-left text-sm text-muted-foreground">
                      No songs were recognized. Try a different video or shorter
                      clips.
                    </p>
                  )}
                </ScrollArea>
              </div>
              <DrawerFooter>
                <Link
                  href={result.playlist_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "inline-flex w-full sm:w-auto"
                  )}
                >
                  Open in Spotify
                </Link>
                <DrawerClose render={<Button variant="outline" />}>
                  Close
                </DrawerClose>
              </DrawerFooter>
            </DrawerPopup>
          </Drawer>
        ) : null}

      </div>
    </main>
  )
}
