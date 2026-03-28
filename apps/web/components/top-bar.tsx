"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useSpotifySession } from "@/components/spotify-session-context"
import { cn } from "@/lib/utils"

export function TopBar() {
  const { token, hydrated, login, logout } = useSpotifySession()

  return (
    <header className="shrink-0 border-b border-border px-6">
      <div className="mx-auto flex h-14 w-full max-w-[805px] items-center gap-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="font-heading text-sm font-medium tracking-tight text-foreground hover:opacity-80"
          >
            Mixtract
          </Link>
          <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-muted-foreground">
            v0.1
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {!hydrated ? null : token ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Spotify connected
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              title="Connect Spotify to create playlists"
              onClick={() => void login()}
              className={cn(
                "rounded-full border-0 px-4 font-semibold text-white shadow-none",
                "bg-[#1DB954] hover:bg-[#1ed760]",
                "focus-visible:border-[#1DB954] focus-visible:ring-[#1DB954]/40",
                "dark:bg-[#1DB954] dark:hover:bg-[#1ed760]"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/81+(1).webp" alt="" className="size-4 object-contain" />
              Log in with Spotify
            </Button>
          ) }
        </div>
      </div>
    </header>
  )
}
