"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type OnboardingContextValue = {
  showOnboarding: boolean
  setShowOnboarding: (open: boolean) => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false)
  return (
    <OnboardingContext.Provider value={{ showOnboarding, setShowOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider")
  return ctx
}
