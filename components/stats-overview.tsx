"use client"

import { Camera, AlertTriangle, Shield, Cpu } from "lucide-react"
import type { Camera as CameraType, Incident } from "@/lib/mock-data"
import { cameras as mockCameras, incidents as mockIncidents } from "@/lib/mock-data"

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  description?: string
  color: string
  bgColor: string
}

function StatCard({ label, value, icon: Icon, description, color, bgColor }: StatCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground/70">{description}</p>}
      </div>
    </div>
  )
}

interface StatsOverviewProps {
  cameras?: CameraType[]
  incidents?: Incident[]
}

export function StatsOverview({ cameras = mockCameras, incidents = mockIncidents }: StatsOverviewProps) {
  const totalCameras = cameras.length
  const activeCameras = cameras.filter((c) => c.status === "online").length
  const offlineCameras = cameras.filter((c) => c.status !== "online").length

  const activeIncidents = incidents.filter((i) => !i.endedAt).length

  // Safety score: penalise for active high-threat incidents and offline cameras
  const highIncidents = incidents.filter(
    (i) => !i.endedAt && (i.threatLevel === "high" || i.threatLevel === "critical")
  ).length
  const rawSafety = 100 - highIncidents * 20 - offlineCameras * 5
  const safetyScore = Math.max(0, Math.min(100, rawSafety))
  const safetyLabel =
    safetyScore >= 80 ? "Low risk" : safetyScore >= 55 ? "Moderate risk" : "High risk"

  // Edge vs Cloud routing breakdown (real data from DB route_mode field)
  const totalInc  = incidents.length || 1
  const edgeInc   = incidents.filter((i) => i.routeMode === "LOCAL").length
  const cloudInc  = incidents.filter((i) => i.routeMode === "CLOUD").length
  const hybridInc = incidents.filter((i) => i.routeMode === "LOCAL_VERIFY_CLOUD").length
  const edgePct   = Math.round((edgeInc  / totalInc) * 100)
  const cloudPct  = Math.round((cloudInc / totalInc) * 100)

  // Show whichever is dominant, with full breakdown in description
  const routeLabel = cloudInc >= edgeInc ? "Cloud Processed" : "Edge Processed"
  const routeValue = cloudInc >= edgeInc ? `${cloudPct}%` : `${edgePct}%`
  const routeDesc  = `${edgeInc} edge · ${cloudInc} cloud · ${hybridInc} hybrid`
  const routeColor = cloudInc >= edgeInc ? "text-primary" : "text-success"
  const routeBg    = cloudInc >= edgeInc ? "bg-primary/10" : "bg-success/10"

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Active Cameras"
        value={`${activeCameras} / ${totalCameras}`}
        icon={Camera}
        description={offlineCameras > 0 ? `${offlineCameras} offline` : "All cameras online"}
        color="text-primary"
        bgColor="bg-primary/10"
      />
      <StatCard
        label="Active Incidents"
        value={activeIncidents}
        icon={AlertTriangle}
        description={activeIncidents > 0 ? "Requires review" : "No active incidents"}
        color="text-destructive"
        bgColor="bg-destructive/10"
      />
      <StatCard
        label="Safety Score"
        value={safetyScore}
        icon={Shield}
        description={safetyLabel}
        color={safetyScore >= 80 ? "text-success" : safetyScore >= 55 ? "text-warning" : "text-destructive"}
        bgColor={safetyScore >= 80 ? "bg-success/10" : safetyScore >= 55 ? "bg-warning/10" : "bg-destructive/10"}
      />
      <StatCard
        label={routeLabel}
        value={routeValue}
        icon={Cpu}
        description={routeDesc}
        color={routeColor}
        bgColor={routeBg}
      />
    </div>
  )
}
