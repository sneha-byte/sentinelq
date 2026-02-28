"use client"

import { useState, useEffect } from "react"
import { Bell, ShieldCheck, Sun, Moon } from "lucide-react"
import { incidents } from "@/lib/mock-data"

interface TopHeaderProps {
  activeTab: string
  onNavigate: (tab: string) => void
}

export function TopHeader({ activeTab, onNavigate }: TopHeaderProps) {
  const [time,       setTime]       = useState("")
  const [showNotifs, setShowNotifs] = useState(false)
  const [darkMode,   setDarkMode]   = useState(false)

  const activeIncidents = incidents.filter(i => !i.endedAt && !i.acknowledged)

  useEffect(() => {
    function update() {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // Apply dark mode — set class on <html> AND override CSS vars directly
  // so Tailwind v4's @theme inline values are bypassed at runtime
  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add("dark")
      root.style.setProperty("--background",         "oklch(0.13 0.008 250)")
      root.style.setProperty("--foreground",         "oklch(0.93 0.005 250)")
      root.style.setProperty("--card",               "oklch(0.17 0.008 250)")
      root.style.setProperty("--card-foreground",    "oklch(0.93 0.005 250)")
      root.style.setProperty("--popover",            "oklch(0.17 0.008 250)")
      root.style.setProperty("--popover-foreground", "oklch(0.93 0.005 250)")
      root.style.setProperty("--primary",            "oklch(0.58 0.14 155)")
      root.style.setProperty("--primary-foreground", "oklch(0.10 0.005 250)")
      root.style.setProperty("--secondary",          "oklch(0.22 0.008 250)")
      root.style.setProperty("--secondary-foreground","oklch(0.75 0.01 250)")
      root.style.setProperty("--muted",              "oklch(0.22 0.008 250)")
      root.style.setProperty("--muted-foreground",   "oklch(0.55 0.012 250)")
      root.style.setProperty("--accent",             "oklch(0.25 0.012 155)")
      root.style.setProperty("--accent-foreground",  "oklch(0.58 0.14 155)")
      root.style.setProperty("--destructive",        "oklch(0.60 0.22 25)")
      root.style.setProperty("--border",             "oklch(0.25 0.008 250)")
      root.style.setProperty("--input",              "oklch(0.25 0.008 250)")
      root.style.setProperty("--ring",               "oklch(0.58 0.14 155)")
      root.style.setProperty("--success",            "oklch(0.60 0.16 155)")
    } else {
      root.classList.remove("dark")
      root.style.setProperty("--background",         "oklch(0.972 0.004 80)")
      root.style.setProperty("--foreground",         "oklch(0.16 0.012 60)")
      root.style.setProperty("--card",               "oklch(0.998 0 0)")
      root.style.setProperty("--card-foreground",    "oklch(0.16 0.012 60)")
      root.style.setProperty("--popover",            "oklch(0.998 0 0)")
      root.style.setProperty("--popover-foreground", "oklch(0.16 0.012 60)")
      root.style.setProperty("--primary",            "oklch(0.46 0.13 155)")
      root.style.setProperty("--primary-foreground", "oklch(0.99 0 0)")
      root.style.setProperty("--secondary",          "oklch(0.94 0.006 80)")
      root.style.setProperty("--secondary-foreground","oklch(0.38 0.015 60)")
      root.style.setProperty("--muted",              "oklch(0.94 0.006 80)")
      root.style.setProperty("--muted-foreground",   "oklch(0.52 0.018 60)")
      root.style.setProperty("--accent",             "oklch(0.93 0.015 155)")
      root.style.setProperty("--accent-foreground",  "oklch(0.46 0.13 155)")
      root.style.setProperty("--destructive",        "oklch(0.56 0.22 25)")
      root.style.setProperty("--border",             "oklch(0.90 0.006 80)")
      root.style.setProperty("--input",              "oklch(0.90 0.006 80)")
      root.style.setProperty("--ring",               "oklch(0.46 0.13 155)")
      root.style.setProperty("--success",            "oklch(0.54 0.16 155)")
    }
  }, [darkMode])

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <ShieldCheck className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-foreground">SentinelQ</span>
          <span className="ml-2 hidden text-xs text-muted-foreground md:inline">Edge-to-Cloud Surveillance</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Live time */}
        {time && (
          <div className="hidden items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 md:flex">
            <span className="h-1.5 w-1.5 animate-live rounded-full bg-success" />
            <span className="font-mono text-xs font-medium text-success">{time}</span>
          </div>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(d => !d)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(o => !o)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {activeIncidents.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                {activeIncidents.length}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-border bg-card shadow-lg">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
              </div>
              {activeIncidents.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">All clear. No active alerts.</p>
              ) : (
                activeIncidents.map(i => (
                  <button key={i.id}
                    onClick={() => { onNavigate("incidents"); setShowNotifs(false); }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{i.label}</p>
                      <p className="text-xs text-muted-foreground">{i.cameraName} · Threat {i.threatScore}/100</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          YG
        </div>
      </div>
    </header>
  )
}