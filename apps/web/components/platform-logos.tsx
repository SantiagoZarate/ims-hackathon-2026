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
      {/* YouTube — left, slightly behind, floats up */}
      <div
        aria-hidden
        className="absolute left-0 top-1/2 z-10 size-[65px] -translate-y-1/2 -rotate-8 rounded-xl sm:size-[70px]"
        style={{ animation: "floatUp 3s ease-in-out infinite" }}
      >
        {/* red glow */}
        <div className="absolute inset-0 rounded-xl bg-[#FF0000] opacity-60 blur-xl" />
        <div className="relative size-full rounded-xl bg-[#FF0000] p-2.5 shadow-md ring-2 ring-background sm:p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Youtube_logo.png" alt="" className="size-full object-contain" />
        </div>
      </div>

      {/* Spotify — right, on top, floats down (opposite phase) */}
      <div
        aria-hidden
        className="absolute left-[35px] top-1/2 z-20 size-[65px] -translate-y-1/2 rotate-8 rounded-xl sm:left-10 sm:size-[70px]"
        style={{ animation: "floatDown 3s ease-in-out infinite" }}
      >
        {/* green glow */}
        <div className="absolute inset-0 rounded-xl bg-[#1DB954] opacity-60 blur-xl" />
        <div className="relative size-full rounded-xl bg-[#1DB954] p-2.5 shadow-md ring-2 ring-background sm:p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/81+(1).webp" alt="" className="size-full object-contain" />
        </div>
      </div>
    </div>
  )
}
