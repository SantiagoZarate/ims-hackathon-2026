"use client"

import { ArrowSquareOut } from "@phosphor-icons/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { PlatformLogos } from "@/components/platform-logos"
import { useSpotifySession } from "@/components/spotify-session-context"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { BorderBeam } from "@/components/ui/border-beam"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  analyzeYoutubeStream,
  type AnalyzeSong,
  type SseDoneEvent,
} from "@/lib/api"
import { getStoredAccessToken } from "@/lib/spotify-auth"

type PlaylistInfo = Pick<
  SseDoneEvent,
  "playlist_url" | "playlist_id" | "playlist_name" | "chunks_processed" | "audd_requests"
>

export function HomePage() {
  const searchParams = useSearchParams()
  const { token, authError, clearAuthError } = useSpotifySession()
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [songs, setSongs] = useState<AnalyzeSong[]>([])
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null)

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
      setSongs([])
      setPlaylist(null)
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
      setSongs([])
      setPlaylist(null)
      setProgressMsg(null)
      setChunkProgress(null)
      setDrawerOpen(false)
      setLoading(true)
      console.log("[page] Submitting URL:", youtubeUrl)
      try {
        await analyzeYoutubeStream(youtubeUrl, token, (event) => {
          if (event.type === "progress") {
            setProgressMsg(event.message)
            if (event.total_chunks != null) {
              setChunkProgress({ done: 0, total: event.total_chunks })
            }
          } else if (event.type === "chunk_done") {
            setChunkProgress({ done: event.chunk, total: event.total })
          } else if (event.type === "song") {
            setSongs((prev) => [
              ...prev,
              {
                spotify_id: event.spotify_id,
                spotify_uri: event.spotify_uri,
                title: event.title,
                artist: event.artist,
                label: event.label,
                image_url: event.image_url,
              },
            ])
            setChunkProgress({ done: event.chunk, total: event.total })
            setDrawerOpen(true)
          } else if (event.type === "done") {
            setPlaylist(event)
            setProgressMsg(null)
            setDrawerOpen(true)
          } else if (event.type === "error") {
            setError(event.message)
          }
        })
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
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl">
            <Input
              id="youtube-url"
              name="youtube-url"
              type="url"
              required
              placeholder="https://www.youtube.com/watch?v=…"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={loading || !token}
              className="h-auto min-h-14 w-full rounded-2xl px-5 py-4 text-base placeholder:text-muted-foreground/70 sm:min-h-16 sm:text-xl md:text-2xl md:py-5"
            />
            {loading ? (
              <BorderBeam
                size={300}
                duration={4}
                borderWidth={2}
                colorFrom="transparent"
                colorTo="#1DB954"
              />
            ) : null}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={loading || !token}
            className="min-w-48 rounded-xl px-6"
          >
            {loading
              ? (progressMsg ?? "Working…")
              : "Create playlist"}
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

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} position="bottom">
          <DrawerPopup showBar className="h-[min(90vh,720px)]">
            <DrawerHeader>
              <DrawerTitle>
                {playlist?.playlist_name ?? "Songs found so far…"}
              </DrawerTitle>
              <DrawerDescription>
                {playlist
                  ? `${songs.length} track(s) · ${playlist.chunks_processed} chunk(s)`
                  : chunkProgress
                    ? `Chunk ${chunkProgress.done} of ${chunkProgress.total}…`
                    : (progressMsg ?? "Analyzing…")}
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 max-h-[60vh] flex-1 flex-col px-6">
              <ScrollArea
                scrollFade
                className="min-h-0 flex-1 touch-auto [--fade-size:2rem]"
              >
                {songs.length > 0 ? (
                  <ul className="space-y-3 pb-2 text-left text-sm">
                    {songs.map((s, i) => {
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
                          className="flex items-center gap-3 border-b border-border/60 pb-3 last:border-0 animate-[songIn_200ms_cubic-bezier(0.23,1,0.32,1)_both]"
                        >
                          {s.image_url ? (
                            <img
                              src={s.image_url}
                              alt={line}
                              width={40}
                              height={40}
                              className="size-10 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className="size-10 shrink-0 rounded bg-muted" />
                          )}
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
                ) : playlist ? (
                  <p className="pb-4 text-left text-sm text-muted-foreground">
                    No songs were recognized. Try a different video or shorter
                    clips.
                  </p>
                ) : (
                  <p className="pb-4 text-left text-sm text-muted-foreground">
                    Listening for songs…
                  </p>
                )}
              </ScrollArea>
            </div>
            <DrawerFooter>
              {playlist ? (
                <Drawer>
                  <DrawerTrigger
                    render={
                      <Button
                        size="lg"
                        className="w-full sm:w-auto"
                        type="button"
                      />
                    }
                  >
                    Continue
                  </DrawerTrigger>
                  <DrawerPopup showBar>
                    <DrawerHeader className="text-center">
                      <DrawerTitle>{playlist.playlist_name}</DrawerTitle>
                      <DrawerDescription>
                        {songs.length} track(s) · Ready to share
                      </DrawerDescription>
                    </DrawerHeader>
                    <DrawerPanel>
                      <div className="mx-auto grid max-w-[200px] grid-cols-2 gap-1">
                        {Array.from({ length: 4 }, (_, idx) => {
                          const url = songs[idx]?.image_url
                          return (
                            <div
                              key={idx}
                              className="aspect-square overflow-hidden rounded-lg bg-muted"
                            >
                              {url ? (
                                <img
                                  src={url}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </DrawerPanel>
                    <DrawerFooter
                      className="justify-center sm:justify-center"
                      variant="bare"
                    >
                      <DrawerClose render={<Button variant="ghost" />}>
                        Back
                      </DrawerClose>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          console.log("[page] Share playlist (mock)", playlist.playlist_url)
                        }}
                      >
                        Share
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          console.log("[page] Open App (mock)", playlist.playlist_url)
                        }}
                      >
                        Open App
                      </Button>
                    </DrawerFooter>
                  </DrawerPopup>
                </Drawer>
              ) : null}
              <DrawerClose render={<Button variant="outline" />}>
                {loading ? "Keep open" : "Close"}
              </DrawerClose>
            </DrawerFooter>
          </DrawerPopup>
        </Drawer>

      </div>
    </main>
  )
}
