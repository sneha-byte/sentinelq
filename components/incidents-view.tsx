"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { incidents as mockIncidents, getThreatScore10 } from "@/lib/mock-data"
import type { Incident } from "@/lib/mock-data"
import { IncidentCard, IncidentDetail } from "@/components/incident-panel"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, Bell, Check, ShieldAlert, Clock, Sparkles, ArrowLeft } from "lucide-react"

type Filter   = "all" | "active" | "resolved"
type SortMode = "combined" | "danger" | "time"

function getCombinedScore(incident: Incident): number {
  const score10  = getThreatScore10(incident.threatScore)
  const ageHours = (Date.now() - new Date(incident.startedAt).getTime()) / 3600000
  const recency  = Math.max(0, 1 - ageHours / 24)
  return score10 * 0.7 + recency * 10 * 0.3
}

export function IncidentsView() {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [filter,   setFilter]   = useState<Filter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("combined")
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())
  const [alertSent,    setAlertSent]    = useState<Set<string>>(new Set())

  const sorted = useMemo(() => {
    const list = mockIncidents.filter(i => {
      if (filter === "active"   &&  i.endedAt)  return false
      if (filter === "resolved" && !i.endedAt)  return false
      return true
    })
    return [...list].sort((a, b) => {
      if (sortMode === "danger") return getThreatScore10(b.threatScore) - getThreatScore10(a.threatScore)
      if (sortMode === "time")   return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      return getCombinedScore(b) - getCombinedScore(a)
    })
  }, [filter, sortMode])

  const SORT_OPTIONS: { id: SortMode; label: string; Icon: React.ElementType; desc: string }[] = [
    { id: "combined", label: "Smart",  Icon: Sparkles,   desc: "Ranked by danger + recency combined" },
    { id: "danger",   label: "Danger", Icon: ShieldAlert, desc: "Highest danger level first" },
    { id: "time",     label: "Recent", Icon: Clock,       desc: "Most recent incidents first" },
  ]

  // On mobile: show detail view when an incident is selected (stacked)
  // On desktop: always show side-by-side
  const showDetail = selectedIncident !== null

  return (
    <>
      {/* Desktop: side-by-side */}
      <div className="hidden md:flex gap-5 h-[calc(100vh-130px)]">
        {/* List */}
        <div className="flex w-[380px] shrink-0 flex-col rounded-xl border border-border bg-card">
          <ListHeader
            count={sorted.length}
            filter={filter} setFilter={setFilter}
            sortMode={sortMode} setSortMode={setSortMode}
            SORT_OPTIONS={SORT_OPTIONS}
          />
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 p-3">
              {sorted.map(incident => (
                <IncidentCard
                  key={incident.id}
                  incident={{ ...incident, acknowledged: incident.acknowledged || acknowledged.has(incident.id) }}
                  onSelect={setSelectedIncident}
                  selected={selectedIncident?.id === incident.id}
                />
              ))}
              {sorted.length === 0 && <EmptyState />}
            </div>
          </ScrollArea>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-6">
          <DetailOrEmpty
            selectedIncident={selectedIncident}
            acknowledged={acknowledged}
            alertSent={alertSent}
            setAcknowledged={setAcknowledged}
            setAlertSent={setAlertSent}
          />
        </div>
      </div>

      {/* Mobile: stacked */}
      <div className="flex flex-col gap-0 md:hidden">
        {/* Show list when nothing selected */}
        {!showDetail && (
          <div className="flex flex-col rounded-xl border border-border bg-card">
            <ListHeader
              count={sorted.length}
              filter={filter} setFilter={setFilter}
              sortMode={sortMode} setSortMode={setSortMode}
              SORT_OPTIONS={SORT_OPTIONS}
            />
            <div className="flex flex-col gap-2 p-3">
              {sorted.map(incident => (
                <IncidentCard
                  key={incident.id}
                  incident={{ ...incident, acknowledged: incident.acknowledged || acknowledged.has(incident.id) }}
                  onSelect={setSelectedIncident}
                  selected={false}
                />
              ))}
              {sorted.length === 0 && <EmptyState />}
            </div>
          </div>
        )}

        {/* Show detail when selected */}
        {showDetail && selectedIncident && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setSelectedIncident(null)}
              className="flex items-center gap-2 text-sm font-medium text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Back to incidents
            </button>
            <div className="rounded-xl border border-border bg-card p-4">
              <DetailOrEmpty
                selectedIncident={selectedIncident}
                acknowledged={acknowledged}
                alertSent={alertSent}
                setAcknowledged={setAcknowledged}
                setAlertSent={setAlertSent}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ListHeader({ count, filter, setFilter, sortMode, setSortMode, SORT_OPTIONS }: {
  count: number
  filter: Filter
  setFilter: (f: Filter) => void
  sortMode: SortMode
  setSortMode: (s: SortMode) => void
  SORT_OPTIONS: { id: SortMode; label: string; Icon: React.ElementType; desc: string }[]
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">All Incidents</h3>
        </div>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
      </div>
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        {(["all", "active", "resolved"] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
              filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >{f}</button>
        ))}
      </div>
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <span className="text-xs text-muted-foreground mr-1 shrink-0">Sort:</span>
        {SORT_OPTIONS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setSortMode(id)}
            className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              sortMode === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3 w-3" />{label}
          </button>
        ))}
      </div>
      <div className="border-b border-border bg-secondary/30 px-4 py-1.5">
        <p className="text-[11px] text-muted-foreground">
          {SORT_OPTIONS.find(s => s.id === sortMode)?.desc}
        </p>
      </div>
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Check className="mb-3 h-10 w-10 text-success" />
      <p className="text-sm text-muted-foreground">No incidents found</p>
    </div>
  )
}

function DetailOrEmpty({ selectedIncident, acknowledged, alertSent, setAcknowledged, setAlertSent }: {
  selectedIncident: Incident | null
  acknowledged: Set<string>
  alertSent: Set<string>
  setAcknowledged: (fn: (prev: Set<string>) => Set<string>) => void
  setAlertSent: (fn: (prev: Set<string>) => Set<string>) => void
}) {
  if (!selectedIncident) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Select an incident to view details</p>
      </div>
    )
  }
  return (
    <>
      <IncidentDetail
        incident={{ ...selectedIncident, acknowledged: selectedIncident.acknowledged || acknowledged.has(selectedIncident.id) }}
        onAcknowledge={id => setAcknowledged(prev => new Set([...prev, id]))}
        onAlertAuthorities={id => setAlertSent(prev => new Set([...prev, id]))}
      />
      {alertSent.has(selectedIncident.id) && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <Bell className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Authorities have been alerted</p>
            <p className="text-xs text-muted-foreground">Estimated response time: 8 minutes</p>
          </div>
        </div>
      )}
      {acknowledged.has(selectedIncident.id) && !alertSent.has(selectedIncident.id) && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-4">
          <Check className="h-5 w-5 text-success" />
          <p className="text-sm font-medium text-foreground">Incident acknowledged and logged</p>
        </div>
      )}
    </>
  )
}