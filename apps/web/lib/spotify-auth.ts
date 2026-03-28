const PKCE_VERIFIER_KEY = "spotify_pkce_verifier"
const ACCESS_TOKEN_KEY = "spotify_access_token"

export const SPOTIFY_SCOPES = [
  "playlist-modify-private",
  "playlist-modify-public",
].join(" ")

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export async function generateCodeVerifier(): Promise<string> {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return base64UrlEncode(arr.buffer)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return base64UrlEncode(digest)
}

export function getSpotifyClientId(): string {
  const id = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
  if (!id) {
    throw new Error("Missing NEXT_PUBLIC_SPOTIFY_CLIENT_ID")
  }
  return id
}

export function getSpotifyRedirectUri(): string {
  const uri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI
  if (!uri) {
    throw new Error("Missing NEXT_PUBLIC_SPOTIFY_REDIRECT_URI")
  }
  return uri
}

export function getPythonServiceUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL?.replace(/\/$/, "") ||
    "http://localhost:8000"
  )
}

export async function beginSpotifyLogin(): Promise<void> {
  console.log("[spotify-auth] Starting Spotify PKCE login")
  const verifier = await generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    response_type: "code",
    client_id: getSpotifyClientId(),
    scope: SPOTIFY_SCOPES,
    redirect_uri: getSpotifyRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
  })

  const authorizeUrl = `https://accounts.spotify.com/authorize?${params.toString()}`
  console.log("[spotify-auth] Redirecting to Spotify authorize:", authorizeUrl)
  window.location.assign(authorizeUrl)
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  console.log("[spotify-auth] Exchanging authorization code for token")
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)
  if (!verifier) {
    throw new Error("Missing PKCE verifier — try logging in again.")
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getSpotifyRedirectUri(),
    client_id: getSpotifyClientId(),
    code_verifier: verifier,
  })

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    console.error("[spotify-auth] Token exchange failed:", res.status, text)
    throw new Error(`Token exchange failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) {
    throw new Error("Spotify did not return access_token")
  }

  console.log("[spotify-auth] Token exchange successful, token stored in sessionStorage")
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
  sessionStorage.setItem(ACCESS_TOKEN_KEY, json.access_token)
  return json.access_token
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function clearSpotifySession(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
}
