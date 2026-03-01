"use client"

import { cn } from "@/lib/utils"
import { hub as mockHub } from "@/lib/mock-data"
import type { HubStatus } from "@/lib/mock-data"
import { Progress } from "@/components/ui/progress"
import {
  Shield,
  Cpu,
  HardDrive,
  Camera,
  Cloud,
  Zap,
  Clock,
} from "lucide-react"

interface HubStatusBarProps {
  hub?: HubStatus
}

export function HubStatusBar({ hub: hubProp }: HubStatusBarProps) {
  const hub = hubProp ?? mockHub

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      {/* Hub Name & Status */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">{hub.deviceName}</p>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                hub.status === "online" ? "bg-success animate-live" : "bg-destructive"
              )}
            />
            <span
              className={cn(
                "text-[10px] font-mono uppercase",
                hub.status === "online" ? "text-success" : "text-destructive"
              )}
            >
              {hub.status}
            </span>
          </div>
        </div>
      </div>

      <div className="hidden md:block h-8 w-px bg-border" />

      {/* CPU */}
      <div className="flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="w-20">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-mono text-muted-foreground">CPU</span>
            <span className="text-[10px] font-mono text-foreground">{hub.cpuUsage}%</span>
          </div>
          <Progress value={hub.cpuUsage} className="h-1 bg-secondary [&>div]:bg-primary" />
        </div>
      </div>

      {/* Memory */}
      <div className="flex items-center gap-2">
        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="w-20">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-mono text-muted-foreground">MEM</span>
            <span className="text-[10px] font-mono text-foreground">{hub.memoryUsage}%</span>
          </div>
          <Progress value={hub.memoryUsage} className="h-1 bg-secondary [&>div]:bg-chart-2" />
        </div>
      </div>

      <div className="hidden lg:block h-8 w-px bg-border" />

      {/* Cameras */}
      <div className="flex items-center gap-1.5">
        <Camera className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-mono text-foreground">
          {hub.activeCameras}/{hub.totalCameras}
        </span>
        <span className="text-[10px] text-muted-foreground">cams</span>
      </div>

      {/* Processing stats */}
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-success" />
        <span className="text-xs font-mono text-success">{hub.localProcessed}</span>
        <span className="text-[10px] text-muted-foreground">local</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Cloud className="h-3.5 w-3.5 text-chart-2" />
        <span className="text-xs font-mono text-chart-2">{hub.cloudEscalated}</span>
        <span className="text-[10px] text-muted-foreground">cloud</span>
      </div>

      <div className="hidden xl:block h-8 w-px bg-border" />

      {/* Uptime */}
      <div className="flex items-center gap-1.5 ml-auto">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono text-muted-foreground">Uptime: {hub.uptime}</span>
      </div>
    </div>
  )
}
