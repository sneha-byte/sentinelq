"use client"

import { Camera, AlertTriangle, Shield, Cpu } from "lucide-react"

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

export function StatsOverview() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Active Cameras"
        value="6 / 8"
        icon={Camera}
        description="2 offline"
        color="text-primary"
        bgColor="bg-primary/10"
      />
      <StatCard
        label="Active Incidents"
        value="1"
        icon={AlertTriangle}
        description="Requires review"
        color="text-destructive"
        bgColor="bg-destructive/10"
      />
      <StatCard
        label="Safety Score"
        value="73"
        icon={Shield}
        description="Moderate risk"
        color="text-warning"
        bgColor="bg-warning/10"
      />
      <StatCard
        label="Edge Processed"
        value="97.4%"
        icon={Cpu}
        description="847 local inferences"
        color="text-success"
        bgColor="bg-success/10"
      />
    </div>
  )
}
