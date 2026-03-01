"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { Camera } from "@/lib/mock-data"
import { getStatusColor } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import {
  Maximize2,
  Eye,
  User,
  Car,
  Dog,
  HelpCircle,
} from "lucide-react"

function getDetectionIcon(className: string) {
  switch (className) {
    case "person": return User
    case "vehicle": return Car
    case "animal": return Dog
    default: return HelpCircle
  }
}

function getDetectionColor(className: string) {
  switch (className) {
    case "person":  return { border: "#4f8cff", bg: "rgba(79,140,255,0.08)", text: "#4f8cff" }
    case "vehicle": return { border: "#34c38f", bg: "rgba(52,195,143,0.08)", text: "#34c38f" }
    case "animal":  return { border: "#f5b849", bg: "rgba(245,184,73,0.08)", text: "#f5b849" }
    default:        return { border: "#f56565", bg: "rgba(245,101,101,0.08)", text: "#f56565" }
  }
}

interface CameraFeedCardProps {
  camera: Camera
  onExpand?: (camera: Camera) => void
  expanded?: boolean
  /** Ordered list of public video URLs to cycle through */
  videoUrls?: string[]
}

export function CameraFeedCard({
  camera,
  onExpand,
  expanded = false,
  videoUrls = [],
}: CameraFeedCardProps) {
  // ── Video state ───────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)

  // Internal URL list — seeded from the prop but refreshed from /api/clips
  // every time a clip finishes so we always pick up newly-uploaded videos.
  const [localUrls, setLocalUrls] = useState<string[]>(videoUrls)

  // Sync if the parent prop changes (initial load / real-time update)
  useEffect(() => {
    if (videoUrls.length > 0) setLocalUrls(videoUrls)
  }, [videoUrls])

  const [vidIdx, setVidIdx] = useState(0) // always start at 0 = newest
  const [clockStr, setClockStr] = useState("")

  // Track URLs that failed so we never retry them in the same session.
  // If every URL has failed, fall back to the canvas placeholder.
  const failedUrls = useRef<Set<string>>(new Set())
  const [allFailed, setAllFailed] = useState(false)

  const hasVideo = camera.status === "online" && localUrls.length > 0 && !allFailed

  // Keep a live clock string (updates every second)
  useEffect(() => {
    const tick = () =>
      setClockStr(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // When vidIdx changes, load + play the new clip
  useEffect(() => {
    const v = videoRef.current
    if (!v || !hasVideo || localUrls.length === 0) return
    v.src = localUrls[vidIdx % localUrls.length]
    v.load()
    v.play().catch(() => {
      // autoplay may be blocked; user interaction will start it
    })
  }, [vidIdx, localUrls, hasVideo])

  // Advance to the next non-failed clip in the current list
  const advanceClip = useCallback((urls: string[]) => {
    setVidIdx((current) => {
      const total = urls.length
      if (total === 0) return 0
      for (let offset = 1; offset <= total; offset++) {
        const candidate = (current + offset) % total
        if (!failedUrls.current.has(urls[candidate])) {
          return candidate
        }
      }
      // Every URL has been tried and failed — stop cycling, show canvas
      setAllFailed(true)
      return current
    })
  }, [])

  // Re-fetch the clip list from the API, then jump to index 0 (newest clip).
  // Called every time a clip finishes naturally so we always surface the
  // most-recently uploaded H.264 video.
  const refreshAndPlayNewest = useCallback(async () => {
    try {
      const res = await fetch("/api/clips")
      if (res.ok) {
        const { urls } = await res.json() as { urls?: string[] }
        if (urls && urls.length > 0) {
          // Remove previously-failed URLs that are no longer in the list
          const freshFailed = new Set(
            [...failedUrls.current].filter((u) => urls.includes(u))
          )
          failedUrls.current = freshFailed

          setLocalUrls(urls)
          setAllFailed(false)
          setVidIdx(0) // index 0 = newest (API returns newest-first)
          return
        }
      }
    } catch {
      // network error — fall through to normal advance
    }
    // Fallback: just advance within the current list
    advanceClip(localUrls)
  }, [localUrls, advanceClip])

  // When a clip finishes naturally → re-fetch + jump to newest
  const handleEnded = useCallback(() => {
    refreshAndPlayNewest()
  }, [refreshAndPlayNewest])

  // When a clip errors (unsupported codec, 404) → mark failed, skip without re-fetching
  const errorSkipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleError = useCallback(() => {
    if (errorSkipTimer.current) clearTimeout(errorSkipTimer.current)
    errorSkipTimer.current = setTimeout(() => {
      const failedUrl = localUrls[vidIdx % localUrls.length]
      if (failedUrl) failedUrls.current.add(failedUrl)
      advanceClip(localUrls)
    }, 300)
  }, [vidIdx, localUrls, advanceClip])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (errorSkipTimer.current) clearTimeout(errorSkipTimer.current)
    }
  }, [])

  // ── Canvas fallback (animated placeholder) ───────────────────────────────
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const timeRef      = useRef(0)

  const drawFrame = useCallback(() => {
    if (hasVideo) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    if (camera.status === "offline") {
      ctx.fillStyle = "#f0f1f3"
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = "#9ca3af"
      ctx.font = "bold 13px Geist, system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Camera Offline", w / 2, h / 2)
      return
    }

    timeRef.current += 0.015
    ctx.fillStyle = "#1e2330"
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = "#252d3d"
    ctx.fillRect(0, h * 0.62, w, h * 0.38)

    ctx.fillStyle = "#2a3348"
    ctx.fillRect(0, h * 0.3, w * 0.12, h * 0.32)
    ctx.fillRect(w * 0.88, h * 0.28, w * 0.12, h * 0.34)

    const grd = ctx.createRadialGradient(w * 0.5, h * 0.35, 20, w * 0.5, h * 0.35, w * 0.5)
    grd.addColorStop(0, "rgba(79,140,255,0.025)")
    grd.addColorStop(1, "transparent")
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, w, h)

    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 32) {
      const noise = (Math.random() - 0.5) * 6
      data[i] += noise; data[i + 1] += noise; data[i + 2] += noise
    }
    ctx.putImageData(imageData, 0, 0)

    ;(camera.detections ?? []).forEach((det) => {
      const colors = getDetectionColor(det.className)
      const bx = det.bbox.x * w, by = det.bbox.y * h
      const bw = det.bbox.w * w, bh = det.bbox.h * h

      ctx.fillStyle = colors.bg
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 1.5
      ctx.setLineDash([])
      ctx.strokeRect(bx, by, bw, bh)

      const cl = 6
      ctx.lineWidth = 2.5
      const corners: [number, number, number, number, number, number][] = [
        [bx, by + cl, bx, by, bx + cl, by],
        [bx + bw - cl, by, bx + bw, by, bx + bw, by + cl],
        [bx, by + bh - cl, bx, by + bh, bx + cl, by + bh],
        [bx + bw - cl, by + bh, bx + bw, by + bh, bx + bw, by + bh - cl],
      ]
      for (const [x1, y1, x2, y2, x3, y3] of corners) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke()
      }

      const label = `${det.className} ${Math.round(det.confidence * 100)}%`
      ctx.font = "600 9px Geist, system-ui, sans-serif"
      const tw = ctx.measureText(label).width
      const pad = 4, radius = 3, lw = tw + pad * 2, lh = 14
      const ly = by - lh - 2
      ctx.fillStyle = colors.border
      ctx.beginPath(); ctx.roundRect(bx, ly, lw, lh, radius); ctx.fill()
      ctx.fillStyle = "#fff"
      ctx.fillText(label, bx + pad, ly + lh - 4)
    })

    // Timestamp bar
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.fillRect(0, h - 16, w, 16)
    ctx.fillStyle = "#94a3b8"
    ctx.font = "9px Geist Mono, monospace"
    ctx.textAlign = "left"
    ctx.fillText(`${new Date().toLocaleTimeString()} | ${camera.fps ?? 24}FPS`, 6, h - 4)
    ctx.textAlign = "right"
    ctx.fillText(camera.resolution ?? "1920×1080", w - 6, h - 4)

    animFrameRef.current = requestAnimationFrame(drawFrame)
  }, [camera, hasVideo])

  useEffect(() => {
    if (hasVideo) {
      cancelAnimationFrame(animFrameRef.current)
      return
    }
    animFrameRef.current = requestAnimationFrame(drawFrame)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [drawFrame, hasVideo])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200",
        "hover:shadow-md hover:border-primary/20",
        expanded && "col-span-2 row-span-2"
      )}
    >
      {/* Feed area */}
      <div className="relative aspect-video w-full bg-black overflow-hidden">

        {hasVideo ? (
          /* ── Real video player ── */
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onEnded={handleEnded}
              onError={handleError}
              className="h-full w-full object-cover"
            />
            {/* Timestamp overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-black/50 flex items-center justify-between px-1.5 pointer-events-none">
              <span className="text-[9px] font-mono text-slate-300 leading-none">
                {clockStr} | {camera.fps ?? 24}FPS
              </span>
              <span className="text-[9px] font-mono text-slate-300 leading-none">
                {camera.resolution ?? "1920×1080"}
              </span>
            </div>
            {/* Clip counter */}
            {localUrls.length > 1 && (
              <div className="absolute bottom-5 right-2 rounded bg-black/60 px-1.5 py-0.5 pointer-events-none">
                <span className="text-[9px] font-mono text-slate-300">
                  clip {(vidIdx % localUrls.length) + 1}/{localUrls.length}
                </span>
              </div>
            )}
          </>
        ) : (
          /* ── Canvas placeholder ── */
          <canvas
            ref={canvasRef}
            width={480}
            height={270}
            className="h-full w-full rounded-t-xl"
          />
        )}

        {/* LIVE badge */}
        {camera.status === "online" && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-md bg-destructive/90 px-2 py-0.5 pointer-events-none">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive-foreground animate-live" />
            <span className="text-[10px] font-semibold text-destructive-foreground uppercase tracking-wide">Live</span>
          </div>
        )}

        {/* Detection count badge */}
        {(camera.detections?.length ?? 0) > 0 && (
          <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-card/85 backdrop-blur-sm px-2 py-0.5 shadow-sm pointer-events-none">
            <Eye className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-foreground">{camera.detections!.length}</span>
          </div>
        )}

        {/* Expand button */}
        {onExpand && (
          <button
            onClick={() => onExpand(camera)}
            className="absolute bottom-6 right-2.5 rounded-md bg-card/70 p-1 text-muted-foreground opacity-0 transition-all hover:bg-card hover:text-foreground group-hover:opacity-100"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              getStatusColor(camera.status),
              camera.status === "online" && "animate-live"
            )}
          />
          <span className="text-sm font-medium text-foreground truncate">{camera.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(camera.detections?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              {Array.from(new Set(camera.detections!.map((d) => d.className))).map((cls) => {
                const Icon = getDetectionIcon(cls)
                const count = camera.detections!.filter((d) => d.className === cls).length
                return (
                  <span key={cls} className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    <span>{count}</span>
                  </span>
                )
              })}
            </div>
          )}
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
            {camera.routeMode === "LOCAL" ? "Edge" : camera.routeMode === "CLOUD" ? "Cloud" : "Hybrid"}
          </Badge>
        </div>
      </div>
    </div>
  )
}
