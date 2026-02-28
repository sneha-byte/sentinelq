"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { Camera, Detection } from "@/lib/mock-data"
import { getStatusColor } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Eye, Cpu, Cloud, User, Car, Dog, HelpCircle, Lightbulb, Zap } from "lucide-react"

function getDetectionIcon(className: string) {
  switch (className) {
    case "person":  return User
    case "vehicle": return Car
    case "animal":  return Dog
    default:        return HelpCircle
  }
}

function getDetectionColor(className: string) {
  switch (className) {
    case "person":  return { border: "#4f8cff", bg: "rgba(79,140,255,0.08)",  text: "#4f8cff" }
    case "vehicle": return { border: "#34c38f", bg: "rgba(52,195,143,0.08)",  text: "#34c38f" }
    case "animal":  return { border: "#f5b849", bg: "rgba(245,184,73,0.08)",  text: "#f5b849" }
    default:        return { border: "#f56565", bg: "rgba(245,101,101,0.08)", text: "#f56565" }
  }
}

interface CameraFeedCardProps {
  camera: Camera
  onExpand?: (camera: Camera) => void
  expanded?: boolean
}

export function CameraFeedCard({ camera, onExpand, expanded = false }: CameraFeedCardProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const timeRef      = useRef(0)

  // ── Light state ────────────────────────────────────────────────────────────
  const [lightOn,   setLightOn]   = useState(false)
  const [autoLight, setAutoLight] = useState(false)
  const autoOffTimer              = useRef<NodeJS.Timeout | null>(null)

  // Auto-light: turn on when detections exist, off after 5s of no detection
  useEffect(() => {
    if (!autoLight) return
    const hasDetections = camera.detections.length > 0
    if (hasDetections) {
      setLightOn(true)
      if (autoOffTimer.current) clearTimeout(autoOffTimer.current)
      autoOffTimer.current = setTimeout(() => setLightOn(false), 5000)
    }
    return () => { if (autoOffTimer.current) clearTimeout(autoOffTimer.current) }
  }, [autoLight, camera.detections.length])

  // ── Canvas feed ────────────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
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
      ctx.font = "bold 13px system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Camera Offline", w / 2, h / 2)
      return
    }

    timeRef.current += 0.015
    const t = timeRef.current

    // Background — warmer when light is on
    ctx.fillStyle = lightOn ? "#2a2e3a" : "#1e2330"
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = lightOn ? "#303540" : "#252d3d"
    ctx.fillRect(0, h * 0.62, w, h * 0.38)
    ctx.fillStyle = lightOn ? "#323848" : "#2a3348"
    ctx.fillRect(0, h * 0.3, w * 0.12, h * 0.32)
    ctx.fillRect(w * 0.88, h * 0.28, w * 0.12, h * 0.34)

    // Light glow overlay
    if (lightOn) {
      const grd = ctx.createRadialGradient(w * 0.5, 0, 10, w * 0.5, 0, h * 0.9)
      grd.addColorStop(0, "rgba(255,230,120,0.18)")
      grd.addColorStop(1, "transparent")
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)
    }

    // Mild noise
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 32) {
      const noise = (Math.random() - 0.5) * 6
      data[i] += noise; data[i+1] += noise; data[i+2] += noise
    }
    ctx.putImageData(imageData, 0, 0)

    // Bounding boxes
    camera.detections.forEach(det => {
      const colors = getDetectionColor(det.className)
      const bx = det.bbox.x * w, by = det.bbox.y * h
      const bw = det.bbox.w * w, bh = det.bbox.h * h
      ctx.fillStyle = colors.bg
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 1.5
      ctx.strokeRect(bx, by, bw, bh)
      const cl = 6; ctx.lineWidth = 2.5
      ;[[bx,by+cl,bx,by,bx+cl,by],[bx+bw-cl,by,bx+bw,by,bx+bw,by+cl],
        [bx,by+bh-cl,bx,by+bh,bx+cl,by+bh],[bx+bw-cl,by+bh,bx+bw,by+bh,bx+bw,by+bh-cl]
      ].forEach(pts => {
        ctx.beginPath()
        ctx.moveTo(pts[0],pts[1]); ctx.lineTo(pts[2],pts[3]); ctx.lineTo(pts[4],pts[5])
        ctx.stroke()
      })
      const label = `${det.className} ${Math.round(det.confidence * 100)}%`
      ctx.font = "600 9px system-ui, sans-serif"
      const tw = ctx.measureText(label).width
      ctx.fillStyle = colors.border
      ctx.beginPath(); ctx.roundRect(bx, by-14, tw+8, 14, 3); ctx.fill()
      ctx.fillStyle = "#fff"
      ctx.fillText(label, bx+4, by-4)
    })

    // Timestamp bar
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.fillRect(0, h-16, w, 16)
    ctx.fillStyle = "#94a3b8"
    ctx.font = "9px monospace"
    ctx.textAlign = "left"
    ctx.fillText(`${new Date().toLocaleTimeString()} | ${camera.fps}FPS`, 6, h-4)
    ctx.textAlign = "right"
    ctx.fillText(camera.resolution, w-6, h-4)

    animFrameRef.current = requestAnimationFrame(drawFrame)
  }, [camera, lightOn])

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawFrame)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [drawFrame])

  return (
    <div className={cn(
      "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-md hover:border-primary/20",
      expanded && "col-span-2 row-span-2"
    )}>
      {/* Feed */}
      <div className="relative aspect-video w-full">
        <canvas ref={canvasRef} width={480} height={270} className="h-full w-full rounded-t-xl" />

        {/* Live badge */}
        {camera.status === "online" && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-md bg-destructive/90 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-live" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wide">Live</span>
          </div>
        )}

        {/* Detection count */}
        {camera.detections.length > 0 && (
          <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-card/85 backdrop-blur-sm px-2 py-0.5 shadow-sm">
            <Eye className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-foreground">{camera.detections.length}</span>
          </div>
        )}

        {/* Light on indicator */}
        {lightOn && (
          <div className="absolute bottom-6 left-2.5 flex items-center gap-1 rounded-md bg-yellow-400/90 px-2 py-0.5">
            <Lightbulb className="h-3 w-3 text-yellow-900" />
            <span className="text-[10px] font-semibold text-yellow-900">Light On</span>
          </div>
        )}
        {autoLight && !lightOn && (
          <div className="absolute bottom-6 left-2.5 flex items-center gap-1 rounded-md bg-card/80 px-2 py-0.5">
            <Zap className="h-3 w-3 text-yellow-500" />
            <span className="text-[10px] font-semibold text-yellow-600">Auto</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", getStatusColor(camera.status), camera.status === "online" && "animate-live")} />
            <span className="text-sm font-medium text-foreground truncate">{camera.name}</span>
          </div>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium shrink-0">
            {camera.routeMode === "LOCAL" ? "Edge" : camera.routeMode === "CLOUD" ? "Cloud" : "Hybrid"}
          </Badge>
        </div>

        {/* Light controls */}
        {camera.status === "online" && (
          <div className="flex items-center gap-2">
            {/* Manual light */}
            <button
              onClick={() => setLightOn(o => !o)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-all",
                lightOn
                  ? "border-yellow-400/60 bg-yellow-400/15 text-yellow-700"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-yellow-400/40 hover:text-yellow-600"
              )}
            >
              <Lightbulb className="h-3 w-3" />
              {lightOn ? "Light On" : "Light Off"}
            </button>

            {/* Auto light */}
            <button
              onClick={() => setAutoLight(o => !o)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-all",
                autoLight
                  ? "border-yellow-500/60 bg-yellow-500/10 text-yellow-600"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-yellow-400/40 hover:text-yellow-600"
              )}
            >
              <Zap className="h-3 w-3" />
              {autoLight ? "Auto On" : "Auto Off"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}