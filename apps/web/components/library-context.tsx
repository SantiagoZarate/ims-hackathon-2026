"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type LibraryContextValue = {
  libraryOpen: boolean
  setLibraryOpen: (open: boolean) => void
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [libraryOpen, setLibraryOpen] = useState(false)
  return (
    <LibraryContext.Provider value={{ libraryOpen, setLibraryOpen }}>
      {children}
    </LibraryContext.Provider>
  )
}

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error("useLibrary must be used inside LibraryProvider")
  return ctx
}
