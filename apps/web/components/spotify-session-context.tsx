"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  beginSpotifyLogin,
  clearSpotifySession,
  getStoredAccessToken,
} from "@/lib/spotify-auth"

type SpotifySessionContextValue = {
  token: string | null
  hydrated: boolean
  authError: string | null
  login: () => Promise<void>
  logout: () => void
  clearAuthError: () => void
  refreshToken: () => void
}

const SpotifySessionContext = createContext<SpotifySessionContextValue | null>(
  null
)

export function SpotifySessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const refreshToken = useCallback(() => {
    setToken(getStoredAccessToken())
  }, [])

  useEffect(() => {
    refreshToken()
    setHydrated(true)
  }, [refreshToken])

  const login = useCallback(async () => {
    setAuthError(null)
    try {
      await beginSpotifyLogin()
    } catch (e) {
      setAuthError(
        e instanceof Error ? e.message : "Could not start Spotify login"
      )
    }
  }, [])

  const logout = useCallback(() => {
    clearSpotifySession()
    setToken(null)
  }, [])

  const clearAuthError = useCallback(() => {
    setAuthError(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      hydrated,
      authError,
      login,
      logout,
      clearAuthError,
      refreshToken,
    }),
    [token, hydrated, authError, login, logout, clearAuthError, refreshToken]
  )

  return (
    <SpotifySessionContext.Provider value={value}>
      {children}
    </SpotifySessionContext.Provider>
  )
}

export function useSpotifySession() {
  const ctx = useContext(SpotifySessionContext)
  if (!ctx) {
    throw new Error("useSpotifySession must be used within SpotifySessionProvider")
  }
  return ctx
}
