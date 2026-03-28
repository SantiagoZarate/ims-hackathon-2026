"use client"

import { ArrowSquareOut, Queue, Trash } from "@phosphor-icons/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { PlatformLogos } from "@/components/platform-logos"
import { useSpotifySession } from "@/components/spotify-session-context"
import { BorderBeam } from "@/components/ui/border-beam"
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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  analyzeYoutubeStream,
  type AnalyzeSong,
  type SseDoneEvent,
} from "@/lib/api"
import {
  deletePlaylist,
  getHistory,
  savePlaylist,
  type SavedPlaylist,
} from "@/lib/playlist-history"
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
  const songsRef = useRef<AnalyzeSong[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryItems, setLibraryItems] = useState<SavedPlaylist[]>([])
  const [historyTick, setHistoryTick] = useState(0)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleDeletePlaylist = useCallback((id: string) => {
    setRemovingId(id)
    setTimeout(() => {
      const next = deletePlaylist(id)
      setLibraryItems(next)
      setRemovingId(null)
    }, 180)
  }, [])

  const handleSharePlaylist = useCallback(async (url: string, title: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url })
        return
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      /* fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      setError("Could not share or copy the playlist link.")
    }
  }, [])

  const handleOpenInSpotify = useCallback(
    (playlistId: string, fallbackUrl: string) => {
      if (playlistId) {
        window.location.href = `spotify:playlist:${playlistId}`
        return
      }
      window.open(fallbackUrl, "_blank", "noopener,noreferrer")
    },
    [],
  )

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
      songsRef.current = []
      setSongs([])
      setPlaylist(null)
      setDrawerOpen(false)
    }
  }, [token])

  useEffect(() => {
    if (libraryOpen) {
      setLibraryItems(getHistory())
    }
  }, [libraryOpen, historyTick])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!token) {
        setError("Log in with Spotify first.")
        return
      }
      setError(null)
      clearAuthError()
      songsRef.current = []
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
            setSongs((prev) => {
              const next = [
                ...prev,
                {
                  spotify_id: event.spotify_id,
                  spotify_uri: event.spotify_uri,
                  title: event.title,
                  artist: event.artist,
                  label: event.label,
                  image_url: event.image_url,
                },
              ]
              songsRef.current = next
              return next
            })
            setChunkProgress({ done: event.chunk, total: event.total })
            setDrawerOpen(true)
          } else if (event.type === "done") {
            setPlaylist(event)
            setProgressMsg(null)
            setDrawerOpen(true)
            savePlaylist({
              id: event.playlist_id,
              name: event.playlist_name,
              url: event.playlist_url,
              youtube_url: youtubeUrl,
              songs: [...songsRef.current],
              created_at: new Date().toISOString(),
            })
            setHistoryTick((t) => t + 1)
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
    <main className="relative flex min-h-[calc(100svh-3.5rem)] flex-1 flex-col items-center justify-center overflow-hidden px-6 py-10">
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
          <div className="flex flex-wrap items-center justify-center gap-2">
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
            <Drawer open={libraryOpen} onOpenChange={setLibraryOpen} position="bottom">
              <DrawerTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-lg"
                    type="button"
                    className="rounded-xl"
                    disabled={!token}
                    aria-label="Open playlist library"
                  />
                }
              >
                <Queue className="size-5" weight="bold" />
              </DrawerTrigger>
              <DrawerPopup showBar className="h-[min(90vh,720px)]">
                <div className="mx-auto flex w-full max-w-[805px] min-h-0 flex-1 flex-col">
                <DrawerHeader>
                  <DrawerTitle>Library</DrawerTitle>
                  <DrawerDescription>
                    {libraryItems.length} playlist
                    {libraryItems.length === 1 ? "" : "s"}
                  </DrawerDescription>
                </DrawerHeader>
                <div className="flex min-h-0 max-h-[min(60vh,480px)] flex-1 flex-col px-6">
                  {libraryItems.length === 0 ? (
                    <p className="pb-4 text-left text-sm text-muted-foreground">
                      No playlists yet. Complete an analysis to save one here.
                    </p>
                  ) : (
                    <ScrollArea
                      scrollFade
                      className="min-h-0 flex-1 touch-auto [--fade-size:2rem]"
                    >
                      <ul className="space-y-2 pb-2 text-left">
                        {libraryItems.map((item) => (
                          <li
                            key={item.id}
                            className={
                              (removingId === item.id
                                ? "animate-[itemOut_180ms_cubic-bezier(0.23,1,0.32,1)_forwards] "
                                : "") +
                              "flex items-stretch overflow-hidden rounded-xl border border-border/80 bg-muted/30"
                            }
                          >
                            <Drawer position="bottom">
                              <DrawerTrigger
                                render={
                                  <button
                                    type="button"
                                    className="flex flex-1 items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 min-w-0"
                                  />
                                }
                              >
                                <div className="grid shrink-0 grid-cols-2 gap-0.5">
                                  {Array.from({ length: 4 }, (_, idx) => {
                                    const url = item.songs[idx]?.image_url
                                    return (
                                      <div
                                        key={idx}
                                        className="size-8 overflow-hidden rounded bg-muted"
                                      >
                                        {url ? (
                                          <img
                                            src={url}
                                            alt=""
                                            width={32}
                                            height={32}
                                            className="size-full object-cover"
                                          />
                                        ) : null}
                                      </div>
                                    )
                                  })}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">
                                    {item.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(item.created_at).toLocaleString()}{" "}
                                    · {item.songs.length} track
                                    {item.songs.length === 1 ? "" : "s"}
                                  </p>
                                </div>
                              </DrawerTrigger>
                              <DrawerPopup showBar className="h-[min(90vh,720px)]">
                                <DrawerHeader className="text-center">
                                  <DrawerTitle>{item.name}</DrawerTitle>
                                  <DrawerDescription>
                                    {item.songs.length} track(s) · Ready to
                                    share
                                  </DrawerDescription>
                                </DrawerHeader>
                                <DrawerPanel>
                                  <div className="mx-auto grid max-w-[200px] grid-cols-2 gap-1">
                                    {Array.from({ length: 4 }, (_, idx) => {
                                      const url = item.songs[idx]?.image_url
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
                                <div className="flex min-h-0 max-h-[40vh] flex-col px-6">
                                  <ScrollArea
                                    scrollFade
                                    className="min-h-0 flex-1 touch-auto [--fade-size:2rem]"
                                  >
                                    <ul className="space-y-3 pb-2 text-left text-sm">
                                      {item.songs.map((s: AnalyzeSong, i: number) => {
                                        const line =
                                          s.artist && s.title
                                            ? `${s.artist} — ${s.title}`
                                            : (s.label ??
                                              s.title ??
                                              "Unknown track")
                                        const trackHref =
                                          s.spotify_id != null
                                            ? `https://open.spotify.com/track/${s.spotify_id}`
                                            : null
                                        return (
                                          <li
                                            key={`${s.spotify_id ?? s.spotify_uri ?? s.label ?? "t"}-${i}`}
                                            className="flex items-center gap-3 border-b border-border/60 pb-3 last:border-0"
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
                                  </ScrollArea>
                                </div>
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
                                      void handleSharePlaylist(item.url, item.name)
                                    }}
                                  >
                                    Share
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      handleOpenInSpotify(item.id, item.url)
                                    }}
                                  >
                                    Open App
                                  </Button>
                                </DrawerFooter>
                              </DrawerPopup>
                            </Drawer>
                            <button
                              type="button"
                              aria-label="Delete playlist"
                              onClick={() => handleDeletePlaylist(item.id)}
                              disabled={removingId === item.id}
                              className="shrink-0 flex items-center justify-center border-l border-border/80 px-3 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                            >
                              <Trash className="size-4" weight="bold" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </div>
                <DrawerFooter>
                  <DrawerClose render={<Button variant="outline" />}>
                    Close
                  </DrawerClose>
                </DrawerFooter>
                </div>
              </DrawerPopup>
            </Drawer>
          </div>
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
            <div className="mx-auto flex w-full max-w-[805px] min-h-0 flex-1 flex-col">
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
                  <DrawerPopup showBar className="h-[min(72vh,720px)]">
                    <div className="mx-auto flex w-full max-w-[805px] min-h-0 flex-1 flex-col">
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
                          void handleSharePlaylist(
                            playlist.playlist_url,
                            playlist.playlist_name,
                          )
                        }}
                      >
                        Share
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          handleOpenInSpotify(
                            playlist.playlist_id,
                            playlist.playlist_url,
                          )
                        }}
                      >
                        Open App
                      </Button>
                    </DrawerFooter>
                    </div>
                  </DrawerPopup>
                </Drawer>
              ) : null}
              <DrawerClose render={<Button variant="outline" />}>
                {loading ? "Keep open" : "Close"}
              </DrawerClose>
            </DrawerFooter>
            </div>
          </DrawerPopup>
        </Drawer>

      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 select-none text-center leading-none animate-[mixtractFadeIn_1.8s_ease_0.4s_both]"
      >
        <span
          className="font-heading inline-block translate-y-[38%] text-[18vw] font-bold tracking-tighter text-foreground/[0.05]"
          style={{
            maskImage: "linear-gradient(to bottom, black 10%, transparent 75%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 10%, transparent 75%)",
          }}
        >
          Mixtract
        </span>
      </div>
    </main>
  )
}
