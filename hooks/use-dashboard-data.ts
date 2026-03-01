"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  cameras as mockCameras,
  incidents as mockIncidents,
  analyticsData as mockAnalytics,
  hub as mockHub,
} from "@/lib/mock-data"
import type { Camera, Incident, HubStatus, ThreatLevel } from "@/lib/mock-data"

// ── Types ─────────────────────────────────────────────────────────────────────
export type DashboardAnalytics = typeof mockAnalytics

// ── Helpers ───────────────────────────────────────────────────────────────────
function getThreatLevel(score: number): ThreatLevel {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 30) return "medium"
  return "low"
}

function computeAnalytics(incidents: Incident[], cameras: Camera[]): DashboardAnalytics {
  // Incidents over time — last 12 × 2-hour buckets
  const buckets: Record<string, { incidents: number; local: number; cloud: number }> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 2 * 3600_000)
    const label = `${String(Math.floor(t.getHours() / 2) * 2).padStart(2, "0")}:00`
    if (!buckets[label]) buckets[label] = { incidents: 0, local: 0, cloud: 0 }
  }
  incidents.forEach(inc => {
    const t = new Date(inc.startedAt)
    const label = `${String(Math.floor(t.getHours() / 2) * 2).padStart(2, "0")}:00`
    if (buckets[label]) {
      buckets[label].incidents++
      if (inc.routeMode === "LOCAL") buckets[label].local++
      else buckets[label].cloud++
    }
  })
  const incidentsOverTime = Object.entries(buckets).map(([time, v]) => ({ time, ...v }))

  // Detections by type
  const typeCount: Record<string, number> = { Person: 0, Vehicle: 0, Animal: 0, Unknown: 0 }
  incidents.forEach(inc => {
    inc.detections.forEach(d => {
      const key = d.className.charAt(0).toUpperCase() + d.className.slice(1)
      if (key in typeCount) typeCount[key] += d.count
    })
  })
  const detectionsByType = [
    { type: "Person",  count: typeCount.Person,  fill: "var(--color-chart-1)" },
    { type: "Vehicle", count: typeCount.Vehicle, fill: "var(--color-chart-2)" },
    { type: "Animal",  count: typeCount.Animal,  fill: "var(--color-chart-3)" },
    { type: "Unknown", count: typeCount.Unknown, fill: "var(--color-chart-4)" },
  ]

  // Threat distribution
  const td = { Low: 0, Medium: 0, High: 0, Critical: 0 }
  incidents.forEach(inc => {
    if      (inc.threatLevel === "low")      td.Low++
    else if (inc.threatLevel === "medium")   td.Medium++
    else if (inc.threatLevel === "high")     td.High++
    else                                     td.Critical++
  })
  const threatDistribution = Object.entries(td).map(([level, count]) => ({ level, count }))

  // Routing breakdown
  const rc = { local: 0, hybrid: 0, cloud: 0 }
  incidents.forEach(inc => {
    if      (inc.routeMode === "LOCAL")               rc.local++
    else if (inc.routeMode === "LOCAL_VERIFY_CLOUD")  rc.hybrid++
    else                                              rc.cloud++
  })
  const total = incidents.length || 1
  const routingBreakdown = [
    { mode: "Local Only",    count: rc.local,  percentage: Math.round(rc.local  / total * 100) },
    { mode: "Local + Cloud", count: rc.hybrid, percentage: Math.round(rc.hybrid / total * 100) },
    { mode: "Cloud Escalated", count: rc.cloud, percentage: Math.round(rc.cloud / total * 100) },
  ]

  // Camera activity
  const cameraActivity = cameras.map(c => ({
    name: c.name.length > 12 ? c.name.substring(0, 12) + "…" : c.name,
    detections: c.detections?.length ?? 0,
    incidents: incidents.filter(i => i.cameraId === c.id).length,
  }))

  return { incidentsOverTime, detectionsByType, threatDistribution, routingBreakdown, cameraActivity }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDashboardData() {
  const [hub,          setHub]          = useState<HubStatus | null>(null)
  const [cameras,      setCameras]      = useState<Camera[]>(mockCameras)
  const [incidents,    setIncidents]    = useState<Incident[]>(mockIncidents)
  const [analytics,    setAnalytics]    = useState<DashboardAnalytics>(mockAnalytics as DashboardAnalytics)
  const [clipUrls,     setClipUrls]     = useState<string[]>([])
  const [loading,      setLoading]      = useState(true)
  const [usingRealData, setUsingRealData] = useState(false)

  const refresh = useCallback(async () => {
    try {
      // ── Clip URLs via server-side route (bypasses RLS) ─────────────────────
      try {
        const res = await fetch("/api/clips")
        if (res.ok) {
          const { urls } = await res.json()
          if (urls?.length) setClipUrls(urls)
        }
      } catch { /* non-fatal */ }

      // ── Hub ────────────────────────────────────────────────────────────────
      const { data: hubData } = await supabase
        .from("hubs")
        .select("id, device_name, status, cpu_usage, memory_usage, uptime")
        .limit(1)
        .maybeSingle()

      if (hubData) {
        setHub({
          id: hubData.id,
          deviceName: hubData.device_name ?? "SentinelQ Hub",
          status: (hubData.status ?? "online") as "online" | "offline",
          lastSeenAt: new Date().toISOString(),
          cpuUsage: hubData.cpu_usage ?? 0,
          memoryUsage: hubData.memory_usage ?? 0,
          activeCameras: mockCameras.filter(c => c.status === "online").length,
          totalCameras: mockCameras.length,
          localProcessed: 0,
          cloudEscalated: 0,
          uptime: hubData.uptime ?? "—",
        })
      }

      // ── Cameras ────────────────────────────────────────────────────────────
      const { data: camsData } = await supabase
        .from("cameras")
        .select("id, name, status, fps, resolution, quality_score, last_frame_at, route_mode")
        .neq("name", "Lobby Interior")

      let finalCameras = cameras
      if (camsData?.length) {
        const mapped: Camera[] = camsData.map((c: any) => ({
          id: c.id,
          name: c.name ?? "Camera",
          location: "",
          status: (c.status ?? "offline") as Camera["status"],
          fps: c.fps ?? 24,
          resolution: c.resolution ?? "1920×1080",
          qualityScore: c.quality_score ?? 0,
          lastFrameAt: c.last_frame_at ?? new Date().toISOString(),
          detections: [],
          routeMode: (c.route_mode ?? "LOCAL") as Camera["routeMode"],
        }))
        setCameras(mapped)
        finalCameras = mapped
        setUsingRealData(true)
      }

      // ── Incidents ──────────────────────────────────────────────────────────
      const { data: incsData } = await supabase
        .from("incidents")
        .select(`
          id, camera_id, status, primary_label,
          started_at, ended_at, threat_score, quality_score, confidence_score,
          route_mode, summary_local, summary_cloud,
          cameras ( name )
        `)
        .order("started_at", { ascending: false })
        .limit(100)

      if (incsData?.length) {
        const mapped: Incident[] = incsData.map((inc: any) => ({
          id: inc.id,
          cameraId: inc.camera_id ?? "",
          cameraName: inc.cameras?.name ?? "Unknown Camera",
          startedAt: inc.started_at,
          endedAt: inc.ended_at ?? null,
          label: inc.primary_label ?? "Incident",
          threatScore: inc.threat_score ?? 0,
          qualityScore: inc.quality_score ?? 0,
          confidenceScore: inc.confidence_score ?? 0,
          routeMode: (inc.route_mode ?? "LOCAL") as Incident["routeMode"],
          summaryLocal: inc.summary_local ?? "",
          summaryCloud: inc.summary_cloud ?? null,
          detections: [],
          threatLevel: getThreatLevel(inc.threat_score ?? 0),
          acknowledged: false,
        }))
        setIncidents(mapped)
        setAnalytics(computeAnalytics(mapped, finalCameras))
        setUsingRealData(true)
      }
    } catch (err) {
      console.warn("[SentinelQ] Supabase fetch failed — using mock data:", err)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh()

    const incidentCh = supabase
      .channel("sq-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, refresh)
      .subscribe()

    const cameraCh = supabase
      .channel("sq-cameras")
      .on("postgres_changes", { event: "*", schema: "public", table: "cameras" }, refresh)
      .subscribe()

    const hubCh = supabase
      .channel("sq-hubs")
      .on("postgres_changes", { event: "*", schema: "public", table: "hubs" }, refresh)
      .subscribe()

    return () => {
      supabase.removeChannel(incidentCh)
      supabase.removeChannel(cameraCh)
      supabase.removeChannel(hubCh)
    }
  }, [refresh])

  return { hub, cameras, incidents, analytics, clipUrls, loading, usingRealData, refresh }
}
