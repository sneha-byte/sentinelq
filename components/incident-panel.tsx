"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Incident } from "@/lib/mock-data";
import { getThreatColor, getThreatBgColor } from "@/lib/mock-data";
import { fetchIncidentMedia, type IncidentMediaResult } from "@/lib/supabase-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, Clock, Camera, Check,
  Cpu, Cloud, User, Car, Dog, HelpCircle, Phone, ShieldCheck,
  Play, Image, ChevronLeft, ChevronRight, Film,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function getDetectionIcon(className: string) {
  switch (className) {
    case "person":  return User;
    case "vehicle": return Car;
    case "animal":  return Dog;
    default:        return HelpCircle;
  }
}

// ── Media player section ───────────────────────────────────────────────────

function IncidentMediaSection({ incidentId }: { incidentId: string }) {
  const [media, setMedia] = useState<IncidentMediaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [activeSnapIndex, setActiveSnapIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchIncidentMedia(incidentId).then((m) => {
      setMedia(m);
      setLoading(false);
    });
  }, [incidentId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Film className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Incident Media
          </span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 flex-1 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasClips = media && media.clips.length > 0;
  const hasSnaps = media && media.snapshots.length > 0;
  const hasThumbs = media && media.thumbnails.length > 0;

  if (!hasClips && !hasSnaps && !hasThumbs) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Film className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Incident Media
          </span>
        </div>
        <p className="text-sm text-muted-foreground">No media captured for this incident.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Video clips */}
      {hasClips && (
        <div className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Play className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Clip Recording
              </span>
            </div>
            {media!.clips.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveClipIndex((i) => Math.max(0, i - 1))}
                  disabled={activeClipIndex === 0}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {activeClipIndex + 1} / {media!.clips.length}
                </span>
                <button
                  onClick={() =>
                    setActiveClipIndex((i) => Math.min(media!.clips.length - 1, i + 1))
                  }
                  disabled={activeClipIndex === media!.clips.length - 1}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="aspect-video w-full bg-black">
            <video
              key={media!.clips[activeClipIndex]}
              src={media!.clips[activeClipIndex]}
              controls
              className="h-full w-full object-contain"
              poster={hasThumbs ? media!.thumbnails[0] : undefined}
            >
              Your browser does not support video playback.
            </video>
          </div>
        </div>
      )}

      {/* Snapshots */}
      {hasSnaps && (
        <div className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Image className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Snapshots
              </span>
            </div>
            {media!.snapshots.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveSnapIndex((i) => Math.max(0, i - 1))}
                  disabled={activeSnapIndex === 0}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {activeSnapIndex + 1} / {media!.snapshots.length}
                </span>
                <button
                  onClick={() =>
                    setActiveSnapIndex((i) => Math.min(media!.snapshots.length - 1, i + 1))
                  }
                  disabled={activeSnapIndex === media!.snapshots.length - 1}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {/* Main snapshot */}
          <div className="aspect-video w-full bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={media!.snapshots[activeSnapIndex]}
              src={media!.snapshots[activeSnapIndex]}
              alt={`Incident snapshot ${activeSnapIndex + 1}`}
              className="h-full w-full object-contain"
            />
          </div>
          {/* Thumbnail strip */}
          {media!.snapshots.length > 1 && (
            <div className="flex gap-1.5 p-2 overflow-x-auto bg-secondary/20">
              {media!.snapshots.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSnapIndex(i)}
                  className={cn(
                    "shrink-0 h-12 w-20 rounded overflow-hidden border-2 transition-all",
                    activeSnapIndex === i
                      ? "border-primary"
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thumbnails only (no full snapshots) */}
      {!hasSnaps && hasThumbs && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Image className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Thumbnails
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media!.thumbnails.map((url, i) => (
              <div key={i} className="shrink-0 h-20 w-32 rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Incident card ──────────────────────────────────────────────────────────

export function IncidentCard({
  incident, onSelect, selected,
}: {
  incident:  Incident;
  onSelect?: (incident: Incident) => void;
  selected?: boolean;
}) {
  const isActive = !incident.endedAt;
  const timeAgo  = formatDistanceToNow(new Date(incident.startedAt), { addSuffix: true });

  return (
    <button
      onClick={() => onSelect?.(incident)}
      className={cn(
        "w-full text-left rounded-xl border p-3.5 transition-all duration-200 overflow-hidden",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            incident.threatLevel === "critical" || incident.threatLevel === "high"
              ? "bg-destructive/10"
              : incident.threatLevel === "medium" ? "bg-warning/10" : "bg-success/10"
          )}>
            <AlertTriangle className={cn("h-4 w-4", getThreatColor(incident.threatLevel))} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{incident.label}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Camera className="h-3 w-3" />{incident.cameraName}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span suppressHydrationWarning>{timeAgo}</span>
              </span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-xs", getThreatBgColor(incident.threatLevel))}>
          {incident.threatScore}
        </Badge>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {incident.detections.map((det, i) => {
          const Icon = getDetectionIcon(det.className);
          return (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              <Icon className="h-3 w-3" />{det.count}x {det.className}
            </span>
          );
        })}
        {isActive && !incident.acknowledged && (
          <Badge variant="destructive" className="text-[10px] h-5">Active</Badge>
        )}
        {incident.acknowledged && (
          <Badge variant="outline" className="text-[10px] h-5 border-success/30 text-success">
            Acknowledged
          </Badge>
        )}
      </div>
    </button>
  );
}

// ── Incident detail ────────────────────────────────────────────────────────

export function IncidentDetail({
  incident, acknowledged: isAcknowledgedProp, onAcknowledge, onAlertAuthorities,
}: {
  incident:             Incident;
  acknowledged?:        boolean;
  onAcknowledge?:       (id: string) => void;
  onAlertAuthorities?:  (id: string) => void;
}) {
  const isActive       = !incident.endedAt;
  const isAcknowledged = isAcknowledgedProp ?? !!incident.acknowledged;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{incident.label}</h3>
          <Badge variant="outline" className={cn("shrink-0", getThreatBgColor(incident.threatLevel))}>
            Score: {incident.threatScore}/100
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
          {incident.cameraName} · {formatDistanceToNow(new Date(incident.startedAt), { addSuffix: true })}
        </p>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Threat</span>
            <span className={cn("text-sm font-bold", getThreatColor(incident.threatLevel))}>
              {incident.threatScore}%
            </span>
          </div>
          <Progress value={incident.threatScore} className="h-1.5 bg-secondary [&>div]:bg-destructive" />
        </div>
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Quality</span>
            <span className="text-sm font-bold text-foreground">{incident.qualityScore}%</span>
          </div>
          <Progress value={incident.qualityScore} className="h-1.5 bg-secondary [&>div]:bg-primary" />
        </div>
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <span className="text-sm font-bold text-foreground">{incident.confidenceScore}%</span>
          </div>
          <Progress value={incident.confidenceScore} className="h-1.5 bg-secondary [&>div]:bg-chart-2" />
        </div>
      </div>

      {/* ── Incident Media ── */}
      <IncidentMediaSection incidentId={incident.id} />

      {/* Analysis summaries — edge + cloud */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
        {/* Route badge */}
        <div className="flex items-center gap-2">
          {incident.routeMode === "CLOUD" ? (
            <Cloud className="h-4 w-4 text-primary" />
          ) : incident.routeMode === "LOCAL_VERIFY_CLOUD" ? (
            <Cpu className="h-4 w-4 text-warning" />
          ) : (
            <Cpu className="h-4 w-4 text-success" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {incident.routeMode === "CLOUD"
              ? "Cloud Analysis"
              : incident.routeMode === "LOCAL_VERIFY_CLOUD"
              ? "Edge → Cloud Hybrid"
              : "Edge Analysis"}
          </span>
          <span className={cn(
            "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border",
            incident.routeMode === "CLOUD"
              ? "bg-primary/10 text-primary border-primary/20"
              : incident.routeMode === "LOCAL_VERIFY_CLOUD"
              ? "bg-warning/10 text-warning border-warning/20"
              : "bg-success/10 text-success border-success/20"
          )}>
            {incident.routeMode === "CLOUD" ? "CLOUD" : incident.routeMode === "LOCAL_VERIFY_CLOUD" ? "HYBRID" : "EDGE"}
          </span>
        </div>

        {/* Edge / local summary */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Cpu className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Edge</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {incident.summaryLocal?.trim()
              ? incident.summaryLocal
              : `Detection recorded by edge device. Threat score: ${incident.threatScore}/100. Confidence: ${incident.confidenceScore}%.`}
          </p>
        </div>

        {/* Cloud summary — always show section, placeholder if not yet analysed */}
        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Cloud className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Cloud</span>
          </div>
          {incident.summaryCloud?.trim() ? (
            <p className="text-sm text-foreground leading-relaxed">{incident.summaryCloud}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {incident.routeMode === "LOCAL"
                ? "Processed entirely on edge — no cloud verification needed."
                : "Pending cloud analysis…"}
            </p>
          )}
        </div>
      </div>

      {/* Step 1: Acknowledge */}
      {isActive && !isAcknowledged && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Review required before escalating
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confirm you have assessed this incident before alerting authorities.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAcknowledge?.(incident.id)}
            className="mt-3 w-full"
          >
            <Check className="h-4 w-4 mr-1.5" />
            I have reviewed this — Acknowledge
          </Button>
        </div>
      )}

      {/* Step 2: Alert Authorities */}
      {isActive && isAcknowledged && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Incident acknowledged</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                If this requires emergency response, alert authorities now.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onAlertAuthorities?.(incident.id)}
            className="mt-3 w-full"
          >
            <Phone className="h-4 w-4 mr-1.5" />
            Alert Authorities
          </Button>
        </div>
      )}
    </div>
  );
}
