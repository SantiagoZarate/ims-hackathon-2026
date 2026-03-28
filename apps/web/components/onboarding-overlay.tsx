"use client"

import { motion } from "motion/react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const EASE_OUT = [0.23, 1, 0.32, 1] as const

function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none"
}

const STEPS = [
  {
    title: "Copy the link",
    description: "Copy the link of the YouTube video you want.",
    image: "/step-1.png",
  },
  {
    title: "Paste the link",
    description: "Paste the link in the input.",
    image: "/step-2.png",
  },
  {
    title: "Get your playlist",
    description: "Add the playlist to your Spotify.",
    image: "/step-3.png",
  },
] as const

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  )
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const fn = () => setReduced(mq.matches)
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [])
  return reduced
}

type OnboardingOverlayProps = {
  onDismiss: () => void
}

export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  const [activeStep, setActiveStep] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const duration = reducedMotion ? 0.01 : 0.5

  useEffect(() => {
    const t = window.setTimeout(() => {
      setActiveStep((s) => {
        if (s >= STEPS.length - 1) {
          onDismiss()
          return s
        }
        return s + 1
      })
    }, 3000)
    return () => window.clearTimeout(t)
  }, [activeStep, onDismiss])

  return (
    <div className="relative flex size-full flex-col gap-4 p-4 sm:gap-6 sm:p-10">
      <h2
        id="onboarding-title"
        className="shrink-0 text-center text-lg font-medium tracking-tight text-white sm:text-xl"
      >
        How Mixtract works
      </h2>

      <div className="flex min-h-0 flex-1 gap-2 sm:gap-3">
        {STEPS.map((step, index) => {
          const isActive = index === activeStep
          return (
            <motion.div
              key={step.title}
              layout
              transition={{ duration, ease: EASE_OUT }}
              className={cn(
                "relative min-h-0 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-sm",
                isActive ? "flex-3" : "flex-1"
              )}
            >
              <div
                className={cn(
                  "absolute inset-0",
                  !isActive && "grayscale"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={step.image}
                  alt=""
                  className={cn(
                    "size-full object-cover transition-opacity duration-300",
                    isActive ? "opacity-100" : "opacity-40"
                  )}
                  onError={handleImgError}
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-black from-30% via-black/80 to-transparent" />
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 space-y-1.5 p-4 text-left sm:p-6",
                  isActive ? "opacity-100" : "opacity-50"
                )}
              >
                <p className="font-mono text-[10px] font-medium tracking-widest text-white/50 uppercase">
                  Step {index + 1}
                </p>
                <p className="text-lg font-semibold leading-tight text-white sm:text-2xl">
                  {step.title}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2" role="tablist" aria-label="Onboarding progress">
        {STEPS.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeStep}
            aria-label={`Step ${i + 1}`}
            className={cn(
              "size-2 rounded-full transition-colors",
              i === activeStep ? "bg-white" : "bg-white/20"
            )}
            onClick={() => setActiveStep(i)}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="absolute bottom-6 right-6 text-white/60 hover:text-white"
      >
        Skip
      </Button>
    </div>
  )
}
