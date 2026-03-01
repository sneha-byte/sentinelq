"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Camera, Incident } from "@/lib/mock-data";
import { cameras as mockCameras, incidents as mockIncidents } from "@/lib/mock-data";
import { CameraFeedCard } from "@/components/camera-feed-card";
import { IncidentCard, IncidentDetail } from "@/components/incident-panel";
import { Badge } from "@/components/ui/badge";
import { Grid3X3, LayoutGrid, ArrowLeft, AlertTriangle, Wifi, WifiOff, Lightbulb, Zap } from "lucide-react";

function getThreatScore10(score: number) {
  return Math.max(1, Math.min(10, Math.round(score / 10)));
}

interface CamerasViewProps {
  cameras?: Camera[];
  incidents?: Incident[];
  clipUrls?: string[];
  lightStates?: Record<string, boolean>;
  autoMotion?: Record<string, boolean>;
  onToggleLight?: (cameraId: string) => void;
  onToggleAutoMotion?: (cameraId: string) => void;
}

export function CamerasView({
  cameras = mockCameras,
  incidents = mockIncidents,
  clipUrls = [],
  lightStates = {},
  autoMotion = {},
  onToggleLight = () => {},
  onToggleAutoMotion = () => {},
}: CamerasViewProps) {
  const [layout, setLayout] = useState<"grid" | "large">("grid");
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const [selectedCamId, setSelectedCamId] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  const [localLightStates, setLocalLightStates] = useState<Record<string, boolean>>(lightStates);
  const [localAutoMotion, setLocalAutoMotion] = useState<Record<string, boolean>>(autoMotion);

  const handleToggleLight = (id: string) => {
    setLocalLightStates((prev) => ({ ...prev, [id]: !prev[id] }));
    onToggleLight(id);
  };

  const handleToggleAutoMotion = (id: string) => {
    setLocalAutoMotion((prev) => ({ ...prev, [id]: !prev[id] }));
    onToggleAutoMotion(id);
  };

  const selectedCam = cameras.find((c) => c.id === selectedCamId);

  const filteredCameras = cameras.filter((c) => {
    if (filter === "online") return c.status === "online";
    if (filter === "offline") return c.status === "offline" || c.status === "degraded";
    return true;
  });

  const camIncidents = selectedCamId
    ? incidents
        .filter((i) => i.cameraId === selectedCamId)
        .sort((a, b) => getThreatScore10(b.threatScore) - getThreatScore10(a.threatScore))
    : [];

  // ── All cameras grid ──────────────────────────────────────────────────────
  if (!selectedCamId) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">All Cameras</h2>
            <Badge variant="secondary" className="font-normal">
              {cameras.filter((c) => c.status === "online").length} of {cameras.length} online
            </Badge>
          </div>
          <div className="flex items-center gap-2">
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
          {filteredCameras.map((cam) => (
            <div key={cam.id} className="flex flex-col rounded-xl overflow-hidden border border-border">
              <div
                onClick={() => {
                  setSelectedCamId(cam.id);
                  setSelectedIncident(null);
                }}
                className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
              >
                <CameraFeedCard camera={cam} videoUrls={clipUrls} />
              </div>
              {cam.status === "online" && (
                <LightControls
                  cameraId={cam.id}
                  isOn={!!localLightStates[cam.id]}
                  isAuto={!!localAutoMotion[cam.id]}
                  onToggleLight={handleToggleLight}
                  onToggleAuto={handleToggleAutoMotion}
                  compact
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Single camera view ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => {
          setSelectedCamId(null);
          setSelectedIncident(null);
        }}
        className="flex items-center gap-2 text-sm font-medium text-primary w-fit"
      >
        <ArrowLeft className="h-4 w-4" /> Back to all cameras
      </button>

      {/* Feed card */}
      <div className="rounded-xl border border-primary/15 bg-card overflow-hidden max-w-xl">
        <CameraFeedCard camera={selectedCam!} videoUrls={clipUrls} />

        {/* Light controls */}
        {selectedCam!.status === "online" && (
          <div className="border-t border-border px-4 py-3">
            <LightControls
              cameraId={selectedCam!.id}
              isOn={!!localLightStates[selectedCam!.id]}
              isAuto={!!localAutoMotion[selectedCam!.id]}
              onToggleLight={handleToggleLight}
              onToggleAuto={handleToggleAutoMotion}
            />
          </div>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-secondary/30 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {selectedCam!.status === "online" ? (
              <Wifi className="h-3.5 w-3.5 text-success" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
            <span
              className={cn(
                "text-xs font-medium capitalize",
                selectedCam!.status === "online"
                  ? "text-success"
                  : selectedCam!.status === "degraded"
                  ? "text-warning"
                  : "text-destructive"
              )}
            >
              {selectedCam!.status}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{selectedCam!.location}</span>
          <span className="text-xs text-muted-foreground">{selectedCam!.fps} FPS</span>
          <span className="text-xs text-muted-foreground">{selectedCam!.resolution}</span>
          <span className="text-xs text-muted-foreground">Quality: {selectedCam!.qualityScore}%</span>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              selectedCam!.routeMode === "LOCAL"
                ? "bg-success/10 text-success"
                : selectedCam!.routeMode === "CLOUD"
                ? "bg-primary/10 text-primary"
                : "bg-warning/10 text-warning"
            )}
          >
            {selectedCam!.routeMode === "LOCAL"
              ? "Edge"
              : selectedCam!.routeMode === "CLOUD"
              ? "Cloud"
              : "Hybrid"}
          </span>
        </div>
      </div>

      {/* Incidents */}
      <div className="flex items-center gap-2 pt-1">
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Incidents — {selectedCam!.name}
        </h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {camIncidents.length}
        </span>
      </div>

      {camIncidents.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No incidents recorded for this camera.</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:flex gap-4">
            <div className="flex w-[300px] shrink-0 flex-col gap-2">
              {camIncidents.map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={{ ...inc, acknowledged: inc.acknowledged || acknowledged.has(inc.id) }}
                  onSelect={setSelectedIncident}
                  selected={selectedIncident?.id === inc.id}
                />
              ))}
            </div>
            <div className="flex-1 rounded-xl border border-primary/15 bg-card p-5 overflow-y-auto">
              {selectedIncident ? (
                <IncidentDetail
                  incident={{
                    ...selectedIncident,
                    acknowledged: selectedIncident.acknowledged || acknowledged.has(selectedIncident.id),
                  }}
                  onAcknowledge={(id) => setAcknowledged((prev) => new Set([...prev, id]))}
                  onAlertAuthorities={() => {}}
                />
              ) : (
                <div className="flex h-full min-h-[160px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">Select an incident to view details</p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile */}
          <div className="flex flex-col gap-3 md:hidden">
            {selectedIncident ? (
              <>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="flex items-center gap-2 text-sm font-medium text-primary"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to incidents
                </button>
                <div className="rounded-xl border border-primary/15 bg-card p-4">
                  <IncidentDetail
                    incident={{
                      ...selectedIncident,
                      acknowledged: selectedIncident.acknowledged || acknowledged.has(selectedIncident.id),
                    }}
                    onAcknowledge={(id) => setAcknowledged((prev) => new Set([...prev, id]))}
                    onAlertAuthorities={() => {}}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                {camIncidents.map((inc) => (
                  <IncidentCard
                    key={inc.id}
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
  );
}

// ── Light controls component ───────────────────────────────────────────────
function LightControls({
  cameraId,
  isOn,
  isAuto,
  onToggleLight,
  onToggleAuto,
  compact = false,
}: {
  cameraId: string;
  isOn: boolean;
  isAuto: boolean;
  onToggleLight: (id: string) => void;
  onToggleAuto: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", compact ? "px-3 py-2 bg-secondary/30 border-t border-border" : "")}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleLight(cameraId);
        }}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
          isOn
            ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-600 hover:bg-yellow-400/20"
            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
        )}
      >
        <Lightbulb className={cn("h-3.5 w-3.5", isOn && "fill-yellow-400 text-yellow-500")} />
        {isOn ? "Light On" : "Light Off"}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleAuto(cameraId);
        }}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
          isAuto
            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
        )}
      >
        <Zap className={cn("h-3.5 w-3.5", isAuto && "fill-primary/50")} />
        {isAuto ? "Auto: On" : "Auto: Off"}
      </button>
    </div>
  );
}
