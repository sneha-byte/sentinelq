"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { incidents as mockIncidents } from "@/lib/mock-data"
import type { Incident } from "@/lib/mock-data"
import { IncidentCard, IncidentDetail } from "@/components/incident-panel"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertTriangle,
  Bell,
  Check,
} from "lucide-react"

export function IncidentsView() {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    mockIncidents.find(i => !i.endedAt) || mockIncidents[0]
  )
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all")
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())
  const [alertSent, setAlertSent] = useState<Set<string>>(new Set())

  const filteredIncidents = mockIncidents.filter(i => {
    if (filter === "active" && i.endedAt) return false
    if (filter === "resolved" && !i.endedAt) return false
    return true
  })

  return (
    <div className="flex gap-5 h-[calc(100vh-130px)]">
      {/* List */}
      <div className="flex w-[380px] shrink-0 flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">All Incidents</h3>
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

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-2 p-3">
            {filteredIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={{
                  ...incident,
                  acknowledged: incident.acknowledged || acknowledged.has(incident.id),
                }}
                onSelect={setSelectedIncident}
                selected={selectedIncident?.id === incident.id}
              />
            ))}
            {filteredIncidents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Check className="h-10 w-10 text-success mb-3" />
                <p className="text-sm text-muted-foreground">No incidents found</p>
              </div>
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
                acknowledged: selectedIncident.acknowledged || acknowledged.has(selectedIncident.id),
              }}
              onAcknowledge={(id) => setAcknowledged(prev => new Set([...prev, id]))}
              onAlertAuthorities={(id) => setAlertSent(prev => new Set([...prev, id]))}
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
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p className="text-sm">Select an incident to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
