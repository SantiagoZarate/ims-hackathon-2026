"use client"

import Image from "next/image"

import { cn } from "@/lib/utils"

const SPOTIFY_PUBLIC_PATH = "/images%20(1).png"

type PlatformLogosProps = {
  className?: string
}

export function PlatformLogos({ className }: PlatformLogosProps) {
  return (
    <div
      role="img"
      aria-label="YouTube and Spotify"
      className={cn(
        "pointer-events-none relative mx-auto h-16 w-20 shrink-0 sm:h-18 sm:w-22",
        className
      )}
    >
      {/* YouTube — left, slightly behind */}
      <div
        className="absolute left-0 top-1/2 z-10 size-13 -translate-y-1/2 -rotate-8 rounded-xl bg-[#FF0000] p-2 shadow-md ring-2 ring-background sm:size-14 sm:p-2.5"
        aria-hidden
      >
        <Image
          src="/Youtube_logo.png"
          alt=""
          width={52}
          height={52}
          className="size-full object-contain"
        />
      </div>
      {/* Spotify — right, on top, overlapping YouTube by ~40% */}
      <div
        className="absolute left-7 top-1/2 z-20 size-13 -translate-y-1/2 rotate-8 rounded-xl bg-[#1DB954] p-2 shadow-md ring-2 ring-background sm:left-8 sm:size-14 sm:p-2.5"
        aria-hidden
      >
        <Image
          src={SPOTIFY_PUBLIC_PATH}
          alt=""
          width={52}
          height={52}
          className="size-full object-contain"
        />
      </div>
    </div>
  )
}
