"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Incident } from "@/lib/mock-data";
import { IncidentCard, IncidentDetail } from "@/components/incident-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Bell, Check, Loader2 } from "lucide-react";

interface IncidentsViewProps {
  incidents?: Incident[];
}

export function IncidentsView({ incidents = [] }: IncidentsViewProps) {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // When incidents load or update from DB, pick the highest-threat active one
  useEffect(() => {
    if (incidents.length === 0) return;
    setSelectedIncident((prev) => {
      // Keep current selection if it still exists in the new list (updated data)
      if (prev) {
        const refreshed = incidents.find((i) => i.id === prev.id);
        if (refreshed) return refreshed;
      }
      // Otherwise default to first active (highest threat due to sort order)
      return incidents.find((i) => !i.endedAt) ?? incidents[0] ?? null;
    });
  }, [incidents]);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [alertSent, setAlertSent] = useState<Set<string>>(new Set());

  const filteredIncidents = incidents.filter((i) => {
    if (filter === "active" && i.endedAt) return false;
    if (filter === "resolved" && !i.endedAt) return false;
    return true;
  });

  return (
    <div className="flex gap-5 h-[calc(100vh-130px)] min-h-0">
      {/* List */}
      <div className="flex w-[380px] shrink-0 flex-col rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">All Incidents</h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              {incidents.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          {(["all", "active", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-2 p-3">
            {incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="h-8 w-8 text-muted-foreground mb-3 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading incidents…</p>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Check className="h-10 w-10 text-success mb-3" />
                <p className="text-sm text-muted-foreground">No incidents found</p>
              </div>
            ) : (
            filteredIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={{
                  ...incident,
                  acknowledged: incident.acknowledged || acknowledged.has(incident.id),
                }}
                onSelect={setSelectedIncident}
                selected={selectedIncident?.id === incident.id}
              />
            ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detail */}
      <div className="flex-1 rounded-xl border border-border bg-card p-6 overflow-y-auto">
        {selectedIncident ? (
          <>
            <IncidentDetail
              incident={{
                ...selectedIncident,
                acknowledged:
                  selectedIncident.acknowledged || acknowledged.has(selectedIncident.id),
              }}
              acknowledged={acknowledged.has(selectedIncident.id)}
              onAcknowledge={(id) => setAcknowledged((prev) => new Set([...prev, id]))}
              onAlertAuthorities={(id) => setAlertSent((prev) => new Set([...prev, id]))}
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
                <p className="text-sm font-medium text-foreground">
                  Incident acknowledged and logged
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p className="text-sm">Select an incident to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
