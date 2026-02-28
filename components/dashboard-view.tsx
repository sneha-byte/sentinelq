"use client"

import { cameras, incidents } from "@/lib/mock-data"
import { StatsOverview } from "@/components/stats-overview"
import { CameraFeedCard } from "@/components/camera-feed-card"
import { IncidentCard } from "@/components/incident-panel"
import { AlertTriangle, Camera, ChevronRight, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DashboardViewProps {
  onNavigate: (tab: string) => void
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const topCameras = cameras.filter(c => c.status === "online").slice(0, 4)
  const recentIncidents = incidents.slice(0, 3)
  const activeIncident = incidents.find(i => !i.endedAt)

  return (
    <div className="flex flex-col gap-6">
      {/* Active Alert Banner */}
      {activeIncident && (
        <div className="flex items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{activeIncident.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeIncident.cameraName} -- Threat score: {activeIncident.threatScore}/100
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onNavigate("incidents")}
            className="shrink-0"
          >
            Review
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Stats */}
      <StatsOverview />

      {/* Camera Feeds */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Live Feeds</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("cameras")} className="text-sm text-muted-foreground">
            View all
            <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {topCameras.map((cam) => (
            <CameraFeedCard key={cam.id} camera={cam} />
          ))}
        </div>
      </div>

      {/* Recent Incidents */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Recent Incidents</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("incidents")} className="text-sm text-muted-foreground">
            View all
            <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {recentIncidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      </div>
    </div>
  )
}
