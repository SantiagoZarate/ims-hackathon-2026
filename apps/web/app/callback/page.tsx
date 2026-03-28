"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { exchangeCodeForToken } from "@/lib/spotify-auth"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const err = searchParams.get("error")
    const desc = searchParams.get("error_description")
    if (err) {
      router.replace(`/?spotify_error=${encodeURIComponent(desc || err)}`)
      return
    }

    const code = searchParams.get("code")
    if (!code) {
      router.replace("/?spotify_error=missing_code")
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        await exchangeCodeForToken(code)
        if (!cancelled) router.replace("/")
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Login failed"
        if (!cancelled) router.replace(`/?spotify_error=${encodeURIComponent(msg)}`)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Finishing Spotify login…</p>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
