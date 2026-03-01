"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { cameras } from "@/lib/mock-data"
import { CameraFeedCard } from "@/components/camera-feed-card"
import { Badge } from "@/components/ui/badge"
import { Grid3X3, LayoutGrid } from "lucide-react"

export function CamerasView() {
  const [layout, setLayout] = useState<"grid" | "large">("grid")
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all")

  const filteredCameras = cameras.filter(c => {
    if (filter === "online") return c.status === "online"
    if (filter === "offline") return c.status === "offline" || c.status === "degraded"
    return true
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">All Cameras</h2>
          <Badge variant="secondary" className="font-normal">
            {cameras.filter(c => c.status === "online").length} of {cameras.length} online
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            {(["all", "online", "offline"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          {/* Layout */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            <button
              onClick={() => setLayout("grid")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                layout === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayout("large")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                layout === "large" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className={cn(
        "grid gap-4",
        layout === "grid"
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "grid-cols-1 md:grid-cols-2"
      )}>
        {filteredCameras.map((cam) => (
          <CameraFeedCard key={cam.id} camera={cam} />
        ))}
      </div>
    </div>
  )
}
