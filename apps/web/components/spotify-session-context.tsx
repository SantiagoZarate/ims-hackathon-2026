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
  authError: string | null
  login: () => Promise<void>
  logout: () => void
  clearAuthError: () => void
}

const SpotifySessionContext = createContext<SpotifySessionContextValue | null>(
  null
)

export function SpotifySessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const refreshToken = useCallback(() => {
    setToken(getStoredAccessToken())
  }, [])

  useEffect(() => {
    refreshToken()
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
      authError,
      login,
      logout,
      clearAuthError,
    }),
    [token, authError, login, logout, clearAuthError]
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
