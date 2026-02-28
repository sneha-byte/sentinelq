"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { Camera, Detection } from "@/lib/mock-data"
import { getStatusColor } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import {
  Maximize2,
  Eye,
  Cpu,
  Cloud,
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
    case "person": return { border: "#4f8cff", bg: "rgba(79,140,255,0.08)", text: "#4f8cff" }
    case "vehicle": return { border: "#34c38f", bg: "rgba(52,195,143,0.08)", text: "#34c38f" }
    case "animal": return { border: "#f5b849", bg: "rgba(245,184,73,0.08)", text: "#f5b849" }
    default: return { border: "#f56565", bg: "rgba(245,101,101,0.08)", text: "#f56565" }
  }
}

interface CameraFeedCardProps {
  camera: Camera
  onExpand?: (camera: Camera) => void
  expanded?: boolean
}

export function CameraFeedCard({ camera, onExpand, expanded = false }: CameraFeedCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const timeRef = useRef(0)

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
      ctx.font = "bold 13px Geist, system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Camera Offline", w / 2, h / 2)
      return
    }

    timeRef.current += 0.015

    // Soft light background
    ctx.fillStyle = "#1e2330"
    ctx.fillRect(0, 0, w, h)

    const t = timeRef.current

    // Ground
    ctx.fillStyle = "#252d3d"
    ctx.fillRect(0, h * 0.62, w, h * 0.38)

    // Structures
    ctx.fillStyle = "#2a3348"
    ctx.fillRect(0, h * 0.3, w * 0.12, h * 0.32)
    ctx.fillRect(w * 0.88, h * 0.28, w * 0.12, h * 0.34)

    // Subtle ambient light
    const grd = ctx.createRadialGradient(w * 0.5, h * 0.35, 20, w * 0.5, h * 0.35, w * 0.5)
    grd.addColorStop(0, "rgba(79,140,255,0.025)")
    grd.addColorStop(1, "transparent")
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, w, h)

    // Mild noise
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 32) {
      const noise = (Math.random() - 0.5) * 6
      data[i] += noise
      data[i + 1] += noise
      data[i + 2] += noise
    }
    ctx.putImageData(imageData, 0, 0)

    // Detection bounding boxes
    camera.detections.forEach((det) => {
      const colors = getDetectionColor(det.className)
      const bx = det.bbox.x * w
      const by = det.bbox.y * h
      const bw = det.bbox.w * w
      const bh = det.bbox.h * h

      // Fill
      ctx.fillStyle = colors.bg
      ctx.fillRect(bx, by, bw, bh)

      // Border
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 1.5
      ctx.setLineDash([])
      ctx.strokeRect(bx, by, bw, bh)

      // Corner accents
      const cornerLen = 6
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(bx, by + cornerLen); ctx.lineTo(bx, by); ctx.lineTo(bx + cornerLen, by)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(bx + bw - cornerLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cornerLen)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(bx, by + bh - cornerLen); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cornerLen, by + bh)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(bx + bw - cornerLen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cornerLen)
      ctx.stroke()

      // Label
      const label = `${det.className} ${Math.round(det.confidence * 100)}%`
      ctx.font = "600 9px Geist, system-ui, sans-serif"
      const textWidth = ctx.measureText(label).width
      const labelX = bx
      const labelY = by - 2

      ctx.fillStyle = colors.border
      const pad = 4
      const radius = 3
      const lw = textWidth + pad * 2
      const lh = 14
      const ly = labelY - lh
      ctx.beginPath()
      ctx.roundRect(labelX, ly, lw, lh, radius)
      ctx.fill()

      ctx.fillStyle = "#fff"
      ctx.fillText(label, labelX + pad, labelY - 4)
    })

    // Timestamp bar
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.fillRect(0, h - 16, w, 16)
    ctx.fillStyle = "#94a3b8"
    ctx.font = "9px Geist Mono, monospace"
    ctx.textAlign = "left"
    const now = new Date()
    ctx.fillText(`${now.toLocaleTimeString()} | ${camera.fps}FPS`, 6, h - 4)
    ctx.textAlign = "right"
    ctx.fillText(camera.resolution, w - 6, h - 4)

    animFrameRef.current = requestAnimationFrame(drawFrame)
  }, [camera])

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawFrame)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [drawFrame])

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200",
        "hover:shadow-md hover:border-primary/20",
        expanded && "col-span-2 row-span-2"
      )}
    >
      {/* Canvas feed */}
      <div className="relative aspect-video w-full">
        <canvas
          ref={canvasRef}
          width={480}
          height={270}
          className="h-full w-full rounded-t-xl"
        />
        {/* Live badge */}
        {camera.status === "online" && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-md bg-destructive/90 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive-foreground animate-live" />
            <span className="text-[10px] font-semibold text-destructive-foreground uppercase tracking-wide">Live</span>
          </div>
        )}
        {/* Detection count */}
        {camera.detections.length > 0 && (
          <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-card/85 backdrop-blur-sm px-2 py-0.5 shadow-sm">
            <Eye className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-foreground">{camera.detections.length}</span>
          </div>
        )}
        {/* Expand */}
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
          <span className={cn("h-2 w-2 shrink-0 rounded-full", getStatusColor(camera.status), camera.status === "online" && "animate-live")} />
          <span className="text-sm font-medium text-foreground truncate">{camera.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {camera.detections.length > 0 && (
            <div className="flex items-center gap-1">
              {Array.from(new Set(camera.detections.map(d => d.className))).map((cls) => {
                const Icon = getDetectionIcon(cls)
                const count = camera.detections.filter(d => d.className === cls).length
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
