"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useSpotifySession } from "@/components/spotify-session-context"
import { cn } from "@/lib/utils"

export function TopBar() {
  const { token, login, logout } = useSpotifySession()

  return (
    <header className="shrink-0 border-b border-border px-6">
      <div className="mx-auto flex h-14 w-full max-w-[805px] items-center gap-4">
      <Link
        href="/"
        className="font-heading text-sm font-medium tracking-tight text-foreground hover:opacity-80"
      >
        Mixtract
      </Link>

      <div className="ml-auto flex items-center gap-3">
        {token ? (
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
            Log in with Spotify
          </Button>
        )}
      </div>
      </div>
    </header>
  )
}
