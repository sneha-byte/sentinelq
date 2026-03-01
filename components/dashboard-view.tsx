"use client"

import { useState } from "react"
import type { Camera, Incident } from "@/lib/mock-data"
import { cameras as mockCameras, incidents as mockIncidents } from "@/lib/mock-data"
import { StatsOverview } from "@/components/stats-overview"
import { CameraFeedCard } from "@/components/camera-feed-card"
import { IncidentCard } from "@/components/incident-panel"
import {
  AlertTriangle, Camera, ChevronRight, ShieldAlert,
  Siren, Lock, Eye, EyeOff, ShieldCheck, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DashboardViewProps {
  onNavigate: (tab: string) => void
  cameras?: Camera[]
  incidents?: Incident[]
  clipUrls?: string[]
}

function buildDailyBrief(incidents: Incident[], cameras: Camera[]) {
  const total    = incidents.length
  const active   = incidents.filter(i => !i.endedAt).length
  const high     = incidents.filter(i => i.threatLevel === "high" || i.threatLevel === "critical").length
  const resolved = incidents.filter(i => i.endedAt).length
  const online   = cameras.filter(c => c.status === "online").length
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  if (active === 0 && high === 0)
    return { greeting, summary: `All ${total} incidents resolved. ${online} cameras are live and no active threats detected. Your property is secure.`, status: "clear" as const }
  if (active === 1)
    return { greeting, summary: `${total} incidents recorded today with ${high} flagged as high-threat. One is still active and needs your review. ${resolved} others resolved.`, status: "warn" as const }
  return { greeting, summary: `${active} active incidents require your attention out of ${total} recorded today. ${high} were high or critical. Please review when you can.`, status: "alert" as const }
}

const CORRECT_PIN = "1234"

function PinPad({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pin,     setPin]     = useState("")
  const [error,   setError]   = useState(false)
  const [shake,   setShake]   = useState(false)
  const [showPin, setShowPin] = useState(false)

  function press(digit: string) {
    if (pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    setError(false)
    if (next.length === 4) {
      if (next === CORRECT_PIN) {
        setTimeout(onSuccess, 200)
      } else {
        setShake(true)
        setError(true)
        setTimeout(() => { setPin(""); setShake(false) }, 700)
      }
    }
  }

  function del() { setPin(p => p.slice(0, -1)); setError(false) }

  const digits = ["1","2","3","4","5","6","7","8","9","","0","⌫"]

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-base font-bold text-foreground">Authorization Required</h3>
        <p className="mt-1 text-sm text-muted-foreground">Enter your PIN to send a silent 911 request</p>
      </div>

      <div className={cn("flex gap-3", shake && "animate-[wiggle_0.3s_ease-in-out_2]")}>
        {[0,1,2,3].map(i => (
          <div key={i} className={cn(
            "h-4 w-4 rounded-full border-2 transition-all duration-150",
            pin.length > i
              ? error ? "border-destructive bg-destructive" : "border-primary bg-primary"
              : "border-border bg-transparent"
          )} />
        ))}
      </div>
      {error && <p className="text-xs font-medium text-destructive">Incorrect PIN. Try again.</p>}

      <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
        {digits.map((d, i) => (
          d === "" ? <div key={i} /> :
          d === "⌫" ? (
            <button key={i} onClick={del}
              className="flex h-12 items-center justify-center rounded-xl border border-border bg-secondary text-sm font-medium text-muted-foreground hover:bg-secondary/80 transition-colors">
              ⌫
            </button>
          ) : (
            <button key={i} onClick={() => press(d)}
              className="flex h-12 items-center justify-center rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-primary/5 hover:border-primary/30 transition-colors">
              {d}
            </button>
          )
        ))}
      </div>

      <button onClick={() => setShowPin(s => !s)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {showPin ? `PIN hint: ${CORRECT_PIN}` : "Show PIN hint"}
      </button>

      <button onClick={onCancel}
        className="w-full rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/50 transition-colors">
        Cancel
      </button>
    </div>
  )
}

export function DashboardView({
  onNavigate,
  cameras = mockCameras,
  incidents = mockIncidents,
  clipUrls = [],
}: DashboardViewProps) {
  const topCameras      = cameras.filter(c => c.status === "online").slice(0, 4)
  const recentIncidents = incidents.slice(0, 3)
  const activeIncident  = incidents.find(i => !i.endedAt)
  const { greeting, summary, status } = buildDailyBrief(incidents, cameras)

  const [sosStep, setSosStep] = useState<"closed" | "pin" | "confirm" | "sent">("closed")

  return (
    <div className="flex flex-col gap-6">

      {/* ── Hero greeting card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/8 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 right-16 h-24 w-24 rounded-full bg-primary/6 blur-xl" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Daily Brief</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">{greeting}, User</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-lg">{summary}</p>
          </div>
          <div className={cn(
            "flex items-center gap-2 rounded-xl px-3.5 py-2 shrink-0 border",
            status === "clear"
              ? "bg-success/10 border-success/20 text-success"
              : status === "warn"
              ? "bg-warning/10 border-warning/20 text-warning"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          )}>
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-semibold">
              {status === "clear" ? "All Clear" : status === "warn" ? "Heads Up" : "Needs Attention"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Active incident banner ── */}
      {activeIncident && (
        <div className="flex items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex-wrap">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{activeIncident.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeIncident.cameraName} · Threat score: {activeIncident.threatScore}/100
            </p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => onNavigate("incidents")} className="shrink-0 rounded-lg">
            Review <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Stats ── */}
      <StatsOverview cameras={cameras} incidents={incidents} />

      {/* ── Live feeds ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Live Feeds</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("cameras")} className="text-sm text-muted-foreground gap-0.5">
            View all <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {topCameras.map(cam => (
            <CameraFeedCard key={cam.id} camera={cam} videoUrls={clipUrls} />
          ))}
        </div>
      </div>

      {/* ── Recent incidents ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Recent Incidents</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("incidents")} className="text-sm text-muted-foreground gap-0.5">
            View all <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {recentIncidents.map(incident => (
            <div key={incident.id} className="min-w-0">
              <IncidentCard incident={incident} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Silent SOS ── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Siren className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Silent 911 Request</p>
              <p className="text-xs text-muted-foreground">Can't call? Transmit your location and footage silently. PIN required.</p>
            </div>
          </div>
          <button
            onClick={() => setSosStep("pin")}
            className="shrink-0 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all"
          >
            Send SOS
          </button>
        </div>
      </div>

      {/* ── SOS Modal ── */}
      {sosStep !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4 md:items-center"
          onClick={() => { if (sosStep !== "sent") setSosStep("closed") }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {sosStep === "pin" && (
              <PinPad onSuccess={() => setSosStep("confirm")} onCancel={() => setSosStep("closed")} />
            )}

            {sosStep === "confirm" && (
              <div className="flex flex-col gap-5">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                    <Siren className="h-7 w-7 text-destructive" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Confirm Silent SOS</h3>
                  <p className="mt-1 text-sm text-muted-foreground">The following will be sent to emergency dispatch immediately:</p>
                </div>
                <ul className="flex flex-col gap-2.5 rounded-xl bg-secondary/50 p-4">
                  {[
                    "Your current GPS location",
                    "Live footage from all active cameras",
                    "Recent incident data and threat scores",
                    "Device ID and account information",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-center text-xs text-muted-foreground">Only use this in a genuine emergency. Emergency services will be dispatched to your location.</p>
                <button onClick={() => setSosStep("sent")}
                  className="w-full rounded-xl bg-destructive py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity">
                  Confirm — Send SOS Now
                </button>
                <button onClick={() => setSosStep("closed")}
                  className="w-full rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/50 transition-colors">
                  Cancel
                </button>
              </div>
            )}

            {sosStep === "sent" && (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 border border-success/20">
                  <Siren className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">SOS Transmitted</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Emergency services have your location and footage. Help is on the way. Stay as safe as you can.</p>
                </div>
                <div className="w-full rounded-xl bg-secondary/50 border border-border p-4 text-left text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dispatch confirmed</span>
                    <span className="font-semibold text-success">Yes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated ETA</span>
                    <span className="font-semibold text-foreground">~8 minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Case ID</span>
                    <span className="font-mono text-xs font-semibold text-foreground">#SQ-{Date.now().toString().slice(-6)}</span>
                  </div>
                </div>
                <button onClick={() => setSosStep("closed")}
                  className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
