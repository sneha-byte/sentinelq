"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { cameras, incidents } from "@/lib/mock-data"
import { CameraFeedCard } from "@/components/camera-feed-card"
import { IncidentCard, IncidentDetail } from "@/components/incident-panel"
import type { Incident } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Grid3X3, LayoutGrid, ArrowLeft, AlertTriangle } from "lucide-react"

export function CamerasView() {
  const [layout, setLayout] = useState<"grid" | "large">("grid")
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all")

  const [selectedCamId, setSelectedCamId] = useState<string | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())

  const selectedCam = cameras.find(c => c.id === selectedCamId)

  const filteredCameras = cameras.filter(c => {
    if (filter === "online") return c.status === "online"
    if (filter === "offline") return c.status === "offline" || c.status === "degraded"
    return true
  })

  const camIncidents = selectedCamId
    ? incidents
        .filter(i => i.cameraId === selectedCamId)
        .sort((a, b) => b.threatScore - a.threatScore)
    : []

  function openCamera(id: string) {
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

  // ─────────────────────────────────────────────
  // ALL CAMERAS VIEW
  // ─────────────────────────────────────────────
  if (!selectedCamId) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">All Cameras</h2>
            <Badge variant="secondary">
              {cameras.filter(c => c.status === "online").length} of {cameras.length} online
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              {(["all", "online", "offline"] as const).map(f => (
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

            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                onClick={() => setLayout("grid")}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  layout === "grid"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLayout("large")}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  layout === "large"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "grid gap-4",
            layout === "grid"
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-1 md:grid-cols-2"
          )}
        >
          {filteredCameras.map(cam => (
            <div
              key={cam.id}
              onClick={() => openCamera(cam.id)}
              className="cursor-pointer"
            >
              <CameraFeedCard camera={cam} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────
  // SINGLE CAMERA VIEW
  // ─────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-sm font-medium text-primary w-fit"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Constrained Live Feed (Desktop only) */}
      <div className="w-full md:max-w-4xl md:mx-auto">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <CameraFeedCard camera={selectedCam!} expanded />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          Incidents — {selectedCam!.name}
        </h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
          {camIncidents.length}
        </span>
      </div>

      {camIncidents.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No incidents recorded for this camera.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop layout */}
          <div className="hidden md:flex gap-5">
            <div className="flex w-[320px] shrink-0 flex-col gap-2">
              {camIncidents.map(inc => (
                <IncidentCard
                  key={inc.id}
                  incident={{
                    ...inc,
                    acknowledged:
                      inc.acknowledged || acknowledged.has(inc.id),
                  }}
                  onSelect={setSelectedIncident}
                  selected={selectedIncident?.id === inc.id}
                />
              ))}
            </div>

            <div className="flex-1 rounded-xl border border-border bg-card p-5">
              {selectedIncident ? (
                <IncidentDetail
                  incident={{
                    ...selectedIncident,
                    acknowledged:
                      selectedIncident.acknowledged ||
                      acknowledged.has(selectedIncident.id),
                  }}
                  onClose={() => setSelectedIncident(null)}
                  onAcknowledge={id =>
                    setAcknowledged(prev => new Set([...prev, id]))
                  }
                  onAlertAuthorities={() => {}}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Select an incident
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile layout */}
          <div className="flex flex-col gap-3 md:hidden">
            {selectedIncident ? (
              <>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="flex items-center gap-2 text-sm font-medium text-primary"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to incidents
                </button>

                <div className="rounded-xl border border-border bg-card p-4">
                  <IncidentDetail
                    incident={{
                      ...selectedIncident,
                      acknowledged:
                        selectedIncident.acknowledged ||
                        acknowledged.has(selectedIncident.id),
                    }}
                    onClose={() => setSelectedIncident(null)}
                    onAcknowledge={id =>
                      setAcknowledged(prev => new Set([...prev, id]))
                    }
                    onAlertAuthorities={() => {}}
                  />
                </div>
              </>
            ) : (
              camIncidents.map(inc => (
                <IncidentCard
                  key={inc.id}
                  incident={{
                    ...inc,
                    acknowledged:
                      inc.acknowledged || acknowledged.has(inc.id),
                  }}
                  onSelect={setSelectedIncident}
                  selected={false}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}