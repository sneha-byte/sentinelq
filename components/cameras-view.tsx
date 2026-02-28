"use client"

import { useState } from "react"
import { cameras, incidents, getThreatScore10 } from "@/lib/mock-data"
import { CameraFeedCard } from "@/components/camera-feed-card"
import { IncidentCard, IncidentDetail } from "@/components/incident-panel"
import type { Incident } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { Grid2x2, Camera, Wifi, WifiOff, AlertTriangle, ArrowLeft } from "lucide-react"

export function CamerasView() {
  const [selectedCamId,    setSelectedCamId]    = useState<string | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [acknowledged,     setAcknowledged]     = useState<Set<string>>(new Set())

  const selectedCam = cameras.find(c => c.id === selectedCamId)

  const camIncidents = selectedCamId
    ? incidents
        .filter(i => i.cameraId === selectedCamId)
        .sort((a, b) => getThreatScore10(b.threatScore) - getThreatScore10(a.threatScore))
    : []

  function selectCamera(id: string) {
    setSelectedCamId(id)
    setSelectedIncident(null)
  }

  function goBack() {
    if (selectedIncident) {
      setSelectedIncident(null)
    } else {
      setSelectedCamId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Camera selector strip */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Select Camera</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSelectedCamId(null); setSelectedIncident(null); }}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
              selectedCamId === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            <Grid2x2 className="h-3.5 w-3.5" /> All Cameras
          </button>

          {cameras.map(cam => {
            const hasAlert = incidents.some(i => i.cameraId === cam.id && !i.endedAt && !i.acknowledged)
            return (
              <button key={cam.id} onClick={() => selectCamera(cam.id)}
                className={cn(
                  "relative flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                  selectedCamId === cam.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full",
                  cam.status === "online" ? "bg-success" :
                  cam.status === "degraded" ? "bg-warning" : "bg-destructive"
                )} />
                {cam.name}
                {hasAlert && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">!</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* All cameras grid */}
      {selectedCamId === null && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cameras.map(cam => (
            <div key={cam.id} onClick={() => selectCamera(cam.id)}>
              <CameraFeedCard camera={cam} />
            </div>
          ))}
        </div>
      )}

      {/* Single camera view */}
      {selectedCam && (
        <div className="flex flex-col gap-5">

          {/* Feed + meta */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <CameraFeedCard camera={selectedCam} expanded />
            <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-3">
              <div className="flex items-center gap-2">
                {selectedCam.status === "online"
                  ? <Wifi className="h-4 w-4 text-success" />
                  : <WifiOff className="h-4 w-4 text-destructive" />}
                <span className={cn("text-sm font-medium capitalize",
                  selectedCam.status === "online" ? "text-success" :
                  selectedCam.status === "degraded" ? "text-warning" : "text-destructive"
                )}>{selectedCam.status}</span>
              </div>
              <span className="text-sm text-muted-foreground">{selectedCam.location}</span>
              <span className="text-sm text-muted-foreground">{selectedCam.fps} FPS</span>
              <span className="text-sm text-muted-foreground">{selectedCam.resolution}</span>
              <span className="text-sm text-muted-foreground">Quality: {selectedCam.qualityScore}%</span>
              <span className={cn("rounded-lg px-2 py-0.5 text-xs font-medium",
                selectedCam.routeMode === "LOCAL" ? "bg-success/10 text-success" :
                selectedCam.routeMode === "CLOUD" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
              )}>
                {selectedCam.routeMode === "LOCAL" ? "Edge" : selectedCam.routeMode === "CLOUD" ? "Cloud" : "Hybrid"}
              </span>
            </div>
          </div>

          {/* Incidents section */}
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Incidents for {selectedCam.name}</h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{camIncidents.length}</span>
          </div>

          {camIncidents.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No incidents recorded for this camera.</p>
            </div>
          ) : (
            <>
              {/* Desktop: side by side */}
              <div className="hidden md:flex gap-5">
                <div className="flex w-[320px] shrink-0 flex-col gap-2">
                  {camIncidents.map(inc => (
                    <IncidentCard key={inc.id}
                      incident={{ ...inc, acknowledged: inc.acknowledged || acknowledged.has(inc.id) }}
                      onSelect={setSelectedIncident}
                      selected={selectedIncident?.id === inc.id}
                    />
                  ))}
                </div>
                <div className="flex-1 min-h-[200px] rounded-xl border border-border bg-card p-5 overflow-y-auto">
                  {selectedIncident ? (
                    <IncidentDetail
                      incident={{ ...selectedIncident, acknowledged: selectedIncident.acknowledged || acknowledged.has(selectedIncident.id) }}
                      onClose={() => setSelectedIncident(null)}
                      onAcknowledge={id => setAcknowledged(prev => new Set([...prev, id]))}
                      onAlertAuthorities={() => {}}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm text-muted-foreground">Select an incident to view details</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile: stacked */}
              <div className="flex flex-col gap-3 md:hidden">
                {selectedIncident ? (
                  <>
                    <button onClick={goBack} className="flex items-center gap-2 text-sm font-medium text-primary">
                      <ArrowLeft className="h-4 w-4" /> Back to incidents
                    </button>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <IncidentDetail
                        incident={{ ...selectedIncident, acknowledged: selectedIncident.acknowledged || acknowledged.has(selectedIncident.id) }}
                        onClose={() => setSelectedIncident(null)}
                        onAcknowledge={id => setAcknowledged(prev => new Set([...prev, id]))}
                        onAlertAuthorities={() => {}}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    {camIncidents.map(inc => (
                      <IncidentCard key={inc.id}
                        incident={{ ...inc, acknowledged: inc.acknowledged || acknowledged.has(inc.id) }}
                        onSelect={setSelectedIncident}
                        selected={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}