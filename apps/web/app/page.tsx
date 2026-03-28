import { Suspense } from "react"

import { HomePage } from "@/components/home-page"

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100svh-3.5rem)] flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <HomePage />
    </Suspense>
  )
}
