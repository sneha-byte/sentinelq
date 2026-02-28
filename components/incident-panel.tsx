"use client";

import { cn } from "@/lib/utils";
import type { Incident } from "@/lib/mock-data";
import {
  getThreatColor,
  getThreatBgColor,
  getRouteColor,
} from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Clock,
  Camera,
  Check,
  Cpu,
  Cloud,
  User,
  Car,
  Dog,
  HelpCircle,
  Phone,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function getDetectionIcon(className: string) {
  switch (className) {
    case "person":
      return User;
    case "vehicle":
      return Car;
    case "animal":
      return Dog;
    default:
      return HelpCircle;
  }
}

interface IncidentCardProps {
  incident: Incident;
  onSelect?: (incident: Incident) => void;
  selected?: boolean;
}

export function IncidentCard({
  incident,
  onSelect,
  selected,
}: IncidentCardProps) {
  const isActive = !incident.endedAt;
  const timeAgo = formatDistanceToNow(new Date(incident.startedAt), {
    addSuffix: true,
  });

  return (
    <button
      onClick={() => onSelect?.(incident)}
      className={cn(
        "w-full text-left rounded-xl border p-3.5 transition-all duration-200 overflow-hidden",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/30 hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              incident.threatLevel === "critical" ||
                incident.threatLevel === "high"
                ? "bg-destructive/10"
                : incident.threatLevel === "medium"
                  ? "bg-warning/10"
                  : "bg-success/10",
            )}
          >
            <AlertTriangle
              className={cn("h-4 w-4", getThreatColor(incident.threatLevel))}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {incident.label}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Camera className="h-3 w-3" />
                {incident.cameraName}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-xs",
            getThreatBgColor(incident.threatLevel),
          )}
        >
          {incident.threatScore}
        </Badge>
      </div>

      {/* Detections */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {incident.detections.map((det, i) => {
          const Icon = getDetectionIcon(det.className);
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              <Icon className="h-3 w-3" />
              {det.count}x {det.className}
            </span>
          );
        })}
        {isActive && !incident.acknowledged && (
          <Badge variant="destructive" className="text-[10px] h-5">
            Active
          </Badge>
        )}
      </div>
    </button>
  );
}

interface IncidentDetailProps {
  incident: Incident;
  onClose?: () => void;
  onAcknowledge?: (id: string) => void;
  onAlertAuthorities?: (id: string) => void;
}

export function IncidentDetail({
  incident,
  onClose,
  onAcknowledge,
  onAlertAuthorities,
}: IncidentDetailProps) {
  const isActive = !incident.endedAt;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">
            {incident.label}
          </h3>
          <Badge
            variant="outline"
            className={cn("shrink-0", getThreatBgColor(incident.threatLevel))}
          >
            Score: {incident.threatScore}/100
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {incident.cameraName} --{" "}
          {formatDistanceToNow(new Date(incident.startedAt), {
            addSuffix: true,
          })}
        </p>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Threat</span>
            <span
              className={cn(
                "text-sm font-bold",
                getThreatColor(incident.threatLevel),
              )}
            >
              {incident.threatScore}%
            </span>
          </div>
          <Progress
            value={incident.threatScore}
            className="h-1.5 bg-secondary [&>div]:bg-destructive"
          />
        </div>
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Quality</span>
            <span className="text-sm font-bold text-foreground">
              {incident.qualityScore}%
            </span>
          </div>
          <Progress
            value={incident.qualityScore}
            className="h-1.5 bg-secondary [&>div]:bg-primary"
          />
        </div>
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <span className="text-sm font-bold text-foreground">
              {incident.confidenceScore}%
            </span>
          </div>
          <Progress
            value={incident.confidenceScore}
            className="h-1.5 bg-secondary [&>div]:bg-chart-2"
          />
        </div>
      </div>

      {/* AI Summary */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="h-4 w-4 text-success" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Edge Analysis
          </span>
        </div>
        <p className="text-sm text-foreground leading-relaxed">
          {incident.summaryLocal}
        </p>
        {incident.summaryCloud && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Cloud Verification
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {incident.summaryCloud}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {isActive && !incident.acknowledged && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAcknowledge?.(incident.id)}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Acknowledge
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onAlertAuthorities?.(incident.id)}
            className="flex-1"
          >
            <Phone className="h-4 w-4 mr-1.5" />
            Alert Authorities
          </Button>
        </div>
      )}
    </div>
  );
}
