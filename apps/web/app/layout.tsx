import { Geist, Geist_Mono, Inter } from "next/font/google"

import { SpotifySessionProvider } from "@/components/spotify-session-context"
import { ThemeProvider } from "@/components/theme-provider"
import { TopBar } from "@/components/top-bar"
import { cn } from "@/lib/utils"
import Script from "next/script"
import "./globals.css"

const geistHeading = Geist({subsets:['latin'],variable:'--font-heading'});

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable, geistHeading.variable)}
    >
       <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body className="flex min-h-svh flex-col">
        <ThemeProvider>
          <SpotifySessionProvider>
            <TopBar />
            {children}
            <footer className="flex shrink-0 items-center justify-center border-t border-border px-6 py-3">
              <p className="font-mono text-xs text-muted-foreground">
                Press <kbd className="rounded-md px-1.5 py-0.5">d</kbd> for dark mode
              </p>
            </footer>
          </SpotifySessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
