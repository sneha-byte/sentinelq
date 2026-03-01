"use client"

import { Home } from "lucide-react"

export function SmartHomeView() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Home className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-base font-semibold text-foreground">Smart Home</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Smart home device integrations and automations — coming soon.
      </p>
    </div>
  )
}
