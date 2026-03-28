"use client"

import { cn } from "@/lib/utils"

type PlatformLogosProps = {
  className?: string
}

export function PlatformLogos({ className }: PlatformLogosProps) {
  return (
    <div
      role="img"
      aria-label="YouTube and Spotify"
      className={cn(
        "pointer-events-none relative mx-auto h-20 w-25 shrink-0 sm:h-22.5 sm:w-27.5",
        className
      )}
    >
      {/* YouTube — left, slightly behind */}
      <div
        className="absolute left-0 top-1/2 z-10 size-[65px] -translate-y-1/2 -rotate-8 rounded-xl bg-[#FF0000] p-2.5 shadow-md ring-2 ring-background sm:size-[70px] sm:p-3"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Youtube_logo.png" alt="" className="size-full object-contain" />
      </div>
      {/* Spotify — right, on top, overlapping YouTube by ~40% */}
      <div
        className="absolute left-[35px] top-1/2 z-20 size-[65px] -translate-y-1/2 rotate-8 rounded-xl bg-[#1DB954] p-2.5 shadow-md ring-2 ring-background sm:left-10 sm:size-[70px] sm:p-3"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/81+(1).webp" alt="" className="size-full object-contain" />
      </div>
    </div>
  )
}
