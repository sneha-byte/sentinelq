"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Incident } from "@/lib/mock-data";
import { IncidentCard, IncidentDetail } from "@/components/incident-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle, Bell, Check, Loader2,
  ShieldAlert, Clock, Sparkles, ArrowLeft,
  Cpu, Cloud, GitMerge,
} from "lucide-react";

type Filter    = "all" | "active" | "resolved";
type RouteFilter = "all" | "edge" | "cloud" | "hybrid";
type SortMode  = "combined" | "danger" | "time";

function getThreatScore10(score: number) {
  return Math.max(1, Math.min(10, Math.round(score / 10)));
}

function getCombinedScore(incident: Incident): number {
  const score10  = getThreatScore10(incident.threatScore);
  const ageHours = (Date.now() - new Date(incident.startedAt).getTime()) / 3_600_000;
  const recency  = Math.max(0, 1 - ageHours / 24);
  return score10 * 0.7 + recency * 10 * 0.3;
}

interface IncidentsViewProps {
  incidents?:    Incident[];
  acknowledged:  Set<string>;
  alertSent:     Set<string>;
  onAcknowledge: (id: string) => void;
  onAlertSent:   (id: string) => void;
}

export function IncidentsView({
  incidents = [],
  acknowledged,
  alertSent,
  onAcknowledge,
  onAlertSent,
}: IncidentsViewProps) {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [filter,           setFilter]           = useState<Filter>("all");
  const [routeFilter,      setRouteFilter]      = useState<RouteFilter>("all");
  const [sortMode,         setSortMode]         = useState<SortMode>("combined");

  // When incidents load/update from DB, keep current selection or pick best default
  useEffect(() => {
    if (incidents.length === 0) return;
    setSelectedIncident(prev => {
      if (prev) {
        const refreshed = incidents.find(i => i.id === prev.id);
        if (refreshed) return refreshed;
      }
      return incidents.find(i => !i.endedAt) ?? incidents[0] ?? null;
    });
  }, [incidents]);

  const sorted = useMemo(() => {
    const list = incidents.filter(i => {
      if (filter === "active"   &&  i.endedAt) return false;
      if (filter === "resolved" && !i.endedAt) return false;
      if (routeFilter === "edge"   && i.routeMode !== "LOCAL")               return false;
      if (routeFilter === "cloud"  && i.routeMode !== "CLOUD")               return false;
      if (routeFilter === "hybrid" && i.routeMode !== "LOCAL_VERIFY_CLOUD")  return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sortMode === "danger") return getThreatScore10(b.threatScore) - getThreatScore10(a.threatScore);
      if (sortMode === "time")   return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      return getCombinedScore(b) - getCombinedScore(a);
    });
  }, [incidents, filter, routeFilter, sortMode]);

  const ROUTE_OPTIONS: { id: RouteFilter; label: string; Icon: React.ElementType; color: string }[] = [
    { id: "all",    label: "All",    Icon: AlertTriangle, color: "" },
    { id: "edge",   label: "Edge",   Icon: Cpu,           color: "text-success" },
    { id: "cloud",  label: "Cloud",  Icon: Cloud,         color: "text-primary" },
    { id: "hybrid", label: "Hybrid", Icon: GitMerge,      color: "text-warning" },
  ];

  const SORT_OPTIONS: { id: SortMode; label: string; Icon: React.ElementType }[] = [
    { id: "combined", label: "Smart",  Icon: Sparkles },
    { id: "danger",   label: "Danger", Icon: ShieldAlert },
    { id: "time",     label: "Recent", Icon: Clock },
  ];

  function enriched(inc: Incident) {
    return { ...inc, acknowledged: acknowledged.has(inc.id) };
  }

  // ── Shared list panel ─────────────────────────────────────────────────────
  function ListPanel() {
    return (
      <div className="flex flex-col min-h-0 rounded-xl border border-border bg-card overflow-hidden h-full">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">All Incidents</h3>
          </div>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {sorted.length}
          </span>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 border-b border-border px-3 py-2 shrink-0">
          {(["all", "active", "resolved"] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
              {f}
            </button>
          ))}
        </div>

        {/* Route filter tabs */}
        <div className="flex items-center gap-1 border-b border-border px-3 py-2 shrink-0">
          {ROUTE_OPTIONS.map(({ id, label, Icon, color }) => (
            <button key={id} onClick={() => setRouteFilter(id)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                routeFilter === id
                  ? id === "edge"   ? "bg-success/10 text-success"
                  : id === "cloud"  ? "bg-primary/10 text-primary"
                  : id === "hybrid" ? "bg-warning/10 text-warning"
                  : "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              <Icon className={cn("h-3 w-3", routeFilter === id ? color : "")} />
              {label}
            </button>
          ))}
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-1 border-b border-border px-3 py-2 shrink-0">
          <span className="text-xs text-muted-foreground mr-1">Sort:</span>
          {SORT_OPTIONS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setSortMode(id)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                sortMode === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
              <Icon className="h-3 w-3" />{label}
            </button>
          ))}
        </div>

        {/* Scrollable list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-2 p-3">
            {incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="h-8 w-8 text-muted-foreground mb-3 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading incidents…</p>
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Check className="h-10 w-10 text-success mb-3" />
                <p className="text-sm text-muted-foreground">No incidents found</p>
              </div>
            ) : sorted.map(inc => (
              <IncidentCard
                key={inc.id}
                incident={enriched(inc)}
                onSelect={setSelectedIncident}
                selected={selectedIncident?.id === inc.id}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ── Shared detail panel ───────────────────────────────────────────────────
  function DetailPanel() {
    if (!selectedIncident) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <p className="text-sm">Select an incident to view details</p>
        </div>
      );
    }
    return (
      <>
        <IncidentDetail
          incident={enriched(selectedIncident)}
          acknowledged={acknowledged.has(selectedIncident.id)}
          onAcknowledge={onAcknowledge}
          onAlertAuthorities={onAlertSent}
        />
        {alertSent.has(selectedIncident.id) && (
          <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3">
            <Bell className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Authorities have been alerted</p>
              <p className="text-xs text-muted-foreground">Estimated response time: 8 minutes</p>
            </div>
          </div>
        )}
        {acknowledged.has(selectedIncident.id) && !alertSent.has(selectedIncident.id) && (
          <div className="mt-5 rounded-xl border border-success/20 bg-success/5 p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-success" />
            <p className="text-sm font-medium text-foreground">Incident acknowledged and logged</p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* ── Desktop: side-by-side full height ── */}
      <div
        className="hidden md:grid md:grid-cols-[360px_1fr] gap-5"
        style={{ height: "calc(100vh - 112px)" }}
      >
        <ListPanel />
        <div className="min-h-0 overflow-y-auto rounded-xl border border-primary/15 bg-card p-6">
          <DetailPanel />
        </div>
      </div>

      {/* ── Mobile: stacked ── */}
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
              <DetailPanel />
            </div>
          </>
        ) : (
          <ListPanel />
        )}
      </div>
    </>
  );
}
