"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Shield, Cpu, Cloud, Wifi, Save, Check, Loader2,
} from "lucide-react"
import type { HubStatus } from "@/lib/mock-data"
import { hub as mockHub } from "@/lib/mock-data"
import { fetchHubSettings, saveHubSettings } from "@/lib/supabase-data"

interface SettingsViewProps {
  hub?: HubStatus & { firmwareVersion?: string }
}

export function SettingsView({ hub = mockHub }: SettingsViewProps) {
  const [privacyMode,          setPrivacyMode]          = useState(false)
  const [edgePreference,       setEdgePreference]       = useState(true)
  const [afterHoursAlert,      setAfterHoursAlert]      = useState(true)
  const [autoEscalate,         setAutoEscalate]         = useState(true)
  const [confidenceThreshold,  setConfidenceThreshold]  = useState([60])
  const [maxCloudCalls,        setMaxCloudCalls]        = useState([20])
  const [saved,  setSaved]  = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(false)

  // Load hub settings from Supabase on mount (or when hub changes)
  useEffect(() => {
    if (!hub?.id || hub.id === "hub-001") return // skip mock hub id
    setLoadingSettings(true)
    fetchHubSettings(hub.id).then((s) => {
      if (!s) return
      setPrivacyMode(s.privacy_mode)
      setEdgePreference(s.edge_preference === "edge_first")
      setAutoEscalate(s.escalation_enabled)
      setAfterHoursAlert(s.escalation_enabled) // use same flag for demo
      setConfidenceThreshold([Math.round(s.confidence_threshold * 100)])
      setMaxCloudCalls([s.max_cloud_escalations_per_hour])
    }).finally(() => setLoadingSettings(false))
  }, [hub?.id])

  const handleSave = async () => {
    setSaving(true)
    if (hub?.id && hub.id !== "hub-001") {
      await saveHubSettings(hub.id, {
        privacy_mode: privacyMode,
        edge_preference: edgePreference ? "edge_first" : "balanced",
        confidence_threshold: confidenceThreshold[0] / 100,
        quality_threshold: 60,
        escalation_enabled: autoEscalate,
        max_cloud_escalations_per_hour: maxCloudCalls[0],
      })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const firmwareVersion = (hub as any).firmwareVersion ?? "v2.4.1"

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Configure edge inference and cloud routing</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : saved
            ? <Check className="h-4 w-4 mr-1.5" />
            : <Save className="h-4 w-4 mr-1.5" />}
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </Button>
      </div>

      {loadingSettings && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading hub settings…
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Inference Policy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4 text-primary" />
              Inference Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Edge-First Processing</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Prefer local inference when possible</p>
              </div>
              <Switch checked={edgePreference} onCheckedChange={setEdgePreference} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Auto Cloud Escalation</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Route to cloud on low confidence</p>
              </div>
              <Switch checked={autoEscalate} onCheckedChange={setAutoEscalate} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Confidence Threshold</Label>
                <span className="text-sm font-semibold text-primary">{confidenceThreshold[0]}%</span>
              </div>
              <Slider
                value={confidenceThreshold}
                onValueChange={setConfidenceThreshold}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Escalate to cloud below this confidence
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cloud Budget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cloud className="h-4 w-4 text-chart-2" />
              Cloud Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Max Cloud Calls / Hour</Label>
                <span className="text-sm font-semibold text-foreground">{maxCloudCalls[0]}</span>
              </div>
              <Slider value={maxCloudCalls} onValueChange={setMaxCloudCalls} max={200} step={5} />
            </div>
            <div className="rounded-lg bg-secondary/50 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Current Usage
              </p>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cloud calls today</span>
                  <span className="font-semibold text-foreground">
                    {hub.cloudEscalated} / {maxCloudCalls[0] * 24}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Edge inferences</span>
                  <span className="font-semibold text-foreground">{hub.localProcessed}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-warning" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">After-Hours Alerts</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Escalate threat scores outside business hours
                </p>
              </div>
              <Switch checked={afterHoursAlert} onCheckedChange={setAfterHoursAlert} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Privacy Mode</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Blur faces, minimize data retention
                </p>
              </div>
              <Switch checked={privacyMode} onCheckedChange={setPrivacyMode} />
            </div>
          </CardContent>
        </Card>

        {/* Hub Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wifi className="h-4 w-4 text-success" />
              Hub Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device Name</span>
                <span className="font-mono text-foreground truncate max-w-[180px]">{hub.deviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device ID</span>
                <span className="font-mono text-foreground text-xs">{hub.id.slice(0, 12)}…</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Firmware</span>
                <span className="font-mono text-foreground">{firmwareVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    hub.status === "online" ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
                  )}
                >
                  {hub.status === "online" ? "Connected" : "Offline"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-mono text-foreground">{hub.uptime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Cameras</span>
                <span className="font-mono text-foreground">
                  {hub.activeCameras} / {hub.totalCameras}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
