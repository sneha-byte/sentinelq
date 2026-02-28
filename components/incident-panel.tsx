"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Incident } from "@/lib/mock-data"
import { getThreatColor, getThreatBgColor, getThreatScore10 } from "@/lib/mock-data"
import { Progress } from "@/components/ui/progress"
import {
  AlertTriangle, Clock, Camera, Check, Cpu, Cloud,
  User, Car, Dog, HelpCircle, Phone, Megaphone, X,
  ThumbsUp, ThumbsDown, ShieldCheck, BookOpen, Play,
  CheckCircle, PhoneCall,
} from "lucide-react"

function getDetectionIcon(className: string) {
  switch (className) {
    case "person":  return User
    case "vehicle": return Car
    case "animal":  return Dog
    default:        return HelpCircle
  }
}

function getActionSteps(label: string, score10: number) {
  const immediate: string[] = []
  const future:    string[] = []
  const l = label.toLowerCase()

  if (l.includes("person") || l.includes("loitering") || l.includes("restricted")) {
    immediate.push("Turn on the camera spotlight to deter the individual")
    immediate.push("Alert nearby neighbors about the activity")
    if (score10 >= 7) immediate.push("Call 911 if the individual does not leave")
    future.push("Install motion-triggered lighting in this area")
    future.push("Add signage indicating the area is under surveillance")
    future.push("Consider a physical barrier or access control at entry points")
  } else if (l.includes("vehicle")) {
    immediate.push("Note the vehicle description, color, and any visible plates")
    immediate.push("Do not approach the vehicle alone")
    if (score10 >= 5) immediate.push("Alert neighbors if the vehicle remains")
    future.push("Install a license plate recognition camera at entry and exit points")
    future.push("Add bollards or barriers to restrict unauthorized vehicle access")
    future.push("Review and improve parking lot lighting")
  } else if (l.includes("animal")) {
    immediate.push("Do not approach the animal")
    immediate.push("Keep doors and gates closed")
    future.push("Install perimeter fencing appropriate for local wildlife")
    future.push("Remove food sources that may attract animals")
  } else {
    immediate.push("Review the footage carefully before taking action")
    immediate.push("Alert neighbors if you believe it is a genuine threat")
    future.push("Review camera placement and coverage for this area")
    future.push("Consider upgrading camera resolution for better detection")
  }

  return { immediate, future }
}

// ── Incident Card ─────────────────────────────────────────────────────────────
interface IncidentCardProps {
  incident: Incident
  onSelect?: (incident: Incident) => void
  selected?: boolean
}

export function IncidentCard({ incident, onSelect, selected }: IncidentCardProps) {
  const isActive = !incident.endedAt
  const score10  = getThreatScore10(incident.threatScore)
  const [timeAgo, setTimeAgo] = useState("recently")

  useEffect(() => {
    function update() {
      const diff = Date.now() - new Date(incident.startedAt).getTime()
      const mins = Math.floor(diff / 60000)
      const hrs  = Math.floor(diff / 3600000)
      if (mins < 1)       setTimeAgo("just now")
      else if (mins < 60) setTimeAgo(`${mins} min ago`)
      else if (hrs < 24)  setTimeAgo(`${hrs} hr ago`)
      else                setTimeAgo(`${Math.floor(hrs / 24)}d ago`)
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [incident.startedAt])

  const threatHigh = incident.threatLevel === "critical" || incident.threatLevel === "high"

  return (
    <button
      onClick={() => onSelect?.(incident)}
      className={cn(
        "w-full text-left rounded-2xl border p-4 transition-all duration-200 active:scale-[0.99]",
        isActive && !incident.acknowledged && "border-destructive/30 bg-destructive/5",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : !isActive || incident.acknowledged
          ? "border-border bg-card hover:border-primary/30 hover:shadow-sm"
          : "",
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl",
          threatHigh ? "bg-destructive/10" : incident.threatLevel === "medium" ? "bg-warning/10" : "bg-success/10"
        )}>
          <span className={cn("text-base font-bold leading-none", getThreatColor(incident.threatLevel))}>{score10}</span>
          <span className={cn("text-[9px] leading-none opacity-60", getThreatColor(incident.threatLevel))}>/10</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-snug">{incident.label}</p>
            <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold", getThreatBgColor(incident.threatLevel))}>
              Level {score10}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Camera className="h-3 w-3" />{incident.cameraName}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {incident.detections.map((det, i) => {
              const Icon = getDetectionIcon(det.className)
              return (
                <span key={i} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  <Icon className="h-3 w-3" />{det.count} {det.className}
                </span>
              )
            })}
            {isActive && !incident.acknowledged && (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-live" />
                Active
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Incident Detail ───────────────────────────────────────────────────────────
interface IncidentDetailProps {
  incident: Incident
  onClose?: () => void
  onAcknowledge?: (id: string) => void
  onAlertAuthorities?: (id: string) => void
  onAlertNeighbors?: (id: string) => void
}

export function IncidentDetail({
  incident, onClose, onAcknowledge, onAlertAuthorities, onAlertNeighbors
}: IncidentDetailProps) {
  const isActive  = !incident.endedAt
  const score10   = getThreatScore10(incident.threatScore)
  const canPost   = score10 >= 4
  const can911    = score10 >= 7

  const [timeAgo,         setTimeAgo]         = useState("recently")
  const [callState,       setCallState]       = useState<"idle" | "calling" | "done">("idle")
  const [footageReviewed, setFootageReviewed] = useState(false)
  const [feedback,        setFeedback]        = useState<"none" | "dangerous" | "safe">("none")
  const [showSteps,       setShowSteps]       = useState(false)

  const { immediate, future } = getActionSteps(incident.label, score10)

  useEffect(() => {
    const diff = Date.now() - new Date(incident.startedAt).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs  = Math.floor(diff / 3600000)
    if (mins < 1)       setTimeAgo("just now")
    else if (mins < 60) setTimeAgo(`${mins} min ago`)
    else if (hrs < 24)  setTimeAgo(`${hrs} hr ago`)
    else                setTimeAgo(`${Math.floor(hrs / 24)}d ago`)
  }, [incident.startedAt])

  function handleCall() {
    setCallState("calling")
    setTimeout(() => { setCallState("done"); onAlertAuthorities?.(incident.id) }, 2000)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground leading-snug">{incident.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{incident.cameraName} · {timeAgo}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-xl px-3 py-1 text-sm font-bold", getThreatBgColor(incident.threatLevel))}>
            Level {score10}/10
          </span>
          {onClose && (
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Threat",     val: incident.threatScore,     bar: "bg-destructive" },
          { label: "Quality",    val: incident.qualityScore,    bar: "bg-primary" },
          { label: "Confidence", val: incident.confidenceScore, bar: "bg-success" },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-secondary/50 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="text-sm font-bold text-foreground">{s.val}%</span>
            </div>
            <Progress value={s.val} className={`h-1.5 bg-secondary [&>div]:${s.bar}`} />
          </div>
        ))}
      </div>

      {/* AI Summary */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-success" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Summary</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground">{incident.summaryLocal}</p>
        {incident.summaryCloud && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-2 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cloud Verification</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{incident.summaryCloud}</p>
          </div>
        )}
      </div>

      {/* Feedback */}
      <div className="rounded-xl border border-border bg-secondary/20 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Was this actually dangerous?</p>
        {feedback === "none" ? (
          <div className="flex gap-2">
            <button onClick={() => setFeedback("dangerous")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10">
              <ThumbsUp className="h-4 w-4" /> Yes, it was
            </button>
            <button onClick={() => setFeedback("safe")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/5 py-2.5 text-sm font-semibold text-success hover:bg-success/10">
              <ThumbsDown className="h-4 w-4" /> False alarm
            </button>
          </div>
        ) : (
          <div className={cn("flex items-center gap-2 rounded-xl p-3 text-sm font-medium",
            feedback === "dangerous" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          )}>
            {feedback === "dangerous"
              ? <><ThumbsUp className="h-4 w-4 shrink-0" /> Marked as genuine threat. AI will learn from this.</>
              : <><ThumbsDown className="h-4 w-4 shrink-0" /> Marked as false alarm. AI will learn from this.</>
            }
          </div>
        )}
      </div>

      {/* Action steps */}
      <div className="rounded-xl border border-border bg-secondary/20 p-4">
        <button onClick={() => setShowSteps(o => !o)}
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            What should I do?
          </div>
          <span className="text-base leading-none">{showSteps ? "−" : "+"}</span>
        </button>

        {showSteps && (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">Right now</p>
              <ul className="flex flex-col gap-1.5">
                {immediate.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-bold text-destructive">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Prevent in future</p>
              <ul className="flex flex-col gap-1.5">
                {future.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footage gate */}
      {isActive && !incident.acknowledged && !footageReviewed && (
        <div className="rounded-xl border border-border bg-secondary/20 p-4 text-center">
          <p className="mb-3 text-sm text-muted-foreground">Review the footage before taking action.</p>
          <button onClick={() => setFootageReviewed(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm">
            <Play className="h-4 w-4" /> Review Event Footage
          </button>
        </div>
      )}

      {/* Action buttons */}
      {isActive && !incident.acknowledged && footageReviewed && (
        <div className="flex flex-col gap-2">
          {canPost ? (
            <button onClick={() => onAlertNeighbors?.(incident.id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-3.5 text-sm font-bold text-primary">
              <Megaphone className="h-4 w-4" /> Post to Neighbors
            </button>
          ) : (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-sm font-medium text-muted-foreground">
              <Megaphone className="h-4 w-4" /> Post to Neighbors (requires Level 4+)
            </div>
          )}

          {can911 && callState === "idle" && (
            <button onClick={handleCall}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive py-3.5 text-sm font-bold text-white shadow-sm">
              <Phone className="h-4 w-4" /> Call 911
            </button>
          )}
          {can911 && callState === "calling" && (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/20 py-3.5 text-sm font-semibold text-destructive">
              <PhoneCall className="h-4 w-4 animate-pulse" /> Connecting to dispatch...
            </div>
          )}
          {can911 && callState === "done" && (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-success/20 bg-success/10 py-3.5 text-sm font-semibold text-success">
              <CheckCircle className="h-4 w-4" /> Help is on the way
            </div>
          )}

          <button onClick={() => onAcknowledge?.(incident.id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground">
            <Check className="h-4 w-4" /> Mark as Acknowledged
          </button>
        </div>
      )}
    </div>
  )
}