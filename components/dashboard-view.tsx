"use client"

import { useState } from "react"
import { cameras, incidents, getThreatScore10 } from "@/lib/mock-data"
import { StatsOverview } from "@/components/stats-overview"
import { CameraFeedCard } from "@/components/camera-feed-card"
import { IncidentCard } from "@/components/incident-panel"
import { AlertTriangle, Camera, ChevronRight, ShieldAlert, Phone, Megaphone, Play, PhoneCall, CheckCircle } from "lucide-react"

interface DashboardViewProps {
  onNavigate: (tab: string) => void
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [show911,         setShow911]         = useState(false)
  const [callState,       setCallState]       = useState<"idle" | "calling" | "done">("idle")
  const [footageReviewed, setFootageReviewed] = useState(false)

  const liveCameras      = cameras.filter(c => c.status === "online").slice(0, 4)
  const recentIncidents  = [...incidents].sort((a, b) => b.threatScore - a.threatScore).slice(0, 3)
  const activeIncident   = incidents.find(i => !i.endedAt && !i.acknowledged)
  const score10          = activeIncident ? getThreatScore10(activeIncident.threatScore) : 0

  function handleCall() {
    setCallState("calling")
    setTimeout(() => setCallState("done"), 2000)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Active alert banner */}
      {activeIncident && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{activeIncident.label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {activeIncident.cameraName} · Danger level: <span className="font-bold text-destructive">{score10}/10</span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => { setShow911(true); setFootageReviewed(false); setCallState("idle"); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-sm font-bold text-white shadow-sm"
            >
              <Phone className="h-4 w-4" /> Call 911
            </button>
            <button
              onClick={() => onNavigate("neighbors")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 py-3 text-sm font-bold text-primary"
            >
              <Megaphone className="h-4 w-4" /> Alert Neighbors
            </button>
            <button
              onClick={() => onNavigate("incidents")}
              className="flex items-center justify-center gap-1 rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground"
            >
              Review <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <StatsOverview />

      {/* Live feeds */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Live Feeds</h2>
          </div>
          <button onClick={() => onNavigate("cameras")} className="flex items-center gap-0.5 text-sm font-medium text-primary">
            View all <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {liveCameras.map(cam => <CameraFeedCard key={cam.id} camera={cam} />)}
        </div>
      </section>

      {/* Recent incidents */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Recent Incidents</h2>
          </div>
          <button onClick={() => onNavigate("incidents")} className="flex items-center gap-0.5 text-sm font-medium text-primary">
            View all <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {recentIncidents.map(incident => <IncidentCard key={incident.id} incident={incident} />)}
        </div>
      </section>

      {/* 911 modal */}
      {show911 && activeIncident && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4 md:items-center"
          onClick={() => { if (callState !== "calling") setShow911(false) }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>

            {!footageReviewed && callState === "idle" && (
              <>
                <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                  <Play className="h-7 w-7 text-foreground" />
                </div>
                <h3 className="text-center text-lg font-bold text-foreground mb-2">Review Footage First</h3>
                <p className="text-center text-sm text-muted-foreground mb-4">
                  Please review the event footage before calling 911. Danger level <span className="font-bold text-destructive">{score10}/10</span> on {activeIncident.cameraName}.
                </p>
                <p className="mb-4 rounded-xl bg-secondary/50 p-3 text-sm text-foreground leading-relaxed">
                  {activeIncident.summaryLocal}
                </p>
                <button onClick={() => setFootageReviewed(true)}
                  className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground mb-2">
                  <span className="flex items-center justify-center gap-2"><Play className="h-4 w-4" /> Review Event Footage</span>
                </button>
                <button onClick={() => setShow911(false)}
                  className="w-full rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground">
                  Cancel
                </button>
              </>
            )}

            {footageReviewed && callState === "idle" && (
              <>
                <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                  <Phone className="h-7 w-7 text-destructive" />
                </div>
                <h3 className="text-center text-lg font-bold text-foreground mb-2">Call 911?</h3>
                <p className="text-center text-sm text-muted-foreground mb-6">
                  Danger level <span className="font-bold text-destructive">{score10}/10</span> on <strong>{activeIncident.cameraName}</strong>. Your location and incident data will be shared with dispatch.
                </p>
                <button onClick={handleCall}
                  className="w-full rounded-xl bg-destructive py-3.5 text-base font-bold text-white mb-2 shadow-sm">
                  <span className="flex items-center justify-center gap-2"><Phone className="h-4 w-4" /> Call 911 Now</span>
                </button>
                <button onClick={() => setShow911(false)}
                  className="w-full rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground">
                  Cancel
                </button>
              </>
            )}

            {callState === "calling" && (
              <div className="py-6 text-center">
                <div className="mb-4 flex justify-center">
                  <PhoneCall className="h-12 w-12 text-destructive animate-pulse" />
                </div>
                <p className="font-semibold text-foreground">Connecting to dispatch...</p>
                <p className="mt-1 text-sm text-muted-foreground">Do not close this window</p>
              </div>
            )}

            {callState === "done" && (
              <>
                <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                  <CheckCircle className="h-7 w-7 text-success" />
                </div>
                <h3 className="text-center text-lg font-bold text-success mb-2">Help is on the way</h3>
                <p className="text-center text-sm text-muted-foreground mb-6">
                  Emergency services notified. Footage and location shared with dispatch.
                </p>
                <button onClick={() => { setShow911(false); setCallState("idle"); setFootageReviewed(false); }}
                  className="w-full rounded-xl bg-success py-3.5 text-base font-bold text-white">
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}