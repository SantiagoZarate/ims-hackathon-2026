import { Geist, Geist_Mono, Inter } from "next/font/google"

import { LibraryProvider } from "@/components/library-context"
import { OnboardingProvider } from "@/components/onboarding-context"
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

export const metadata = {
  title: "Mixtract",
  description: "Convert YouTube audio to a Spotify playlist using recognized songs.",
}

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
      <body className="min-h-svh flex-col grid grid-rows-[auto_1fr_auto]">
        <ThemeProvider>
          <SpotifySessionProvider>
            <LibraryProvider>
              <OnboardingProvider>
                <TopBar />
                {children}
              </OnboardingProvider>
              <footer className="shrink-0 border-t border-border px-6 py-3">
                <div className="mx-auto flex w-full max-w-[805px] items-center justify-between">
                  <p className="font-mono text-xs text-muted-foreground">
                    Created by Santi
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Press <kbd className="rounded-md px-1.5 py-0.5">d</kbd> for dark mode
                  </p>
                </div>
              </footer>
            </LibraryProvider>
          </SpotifySessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
