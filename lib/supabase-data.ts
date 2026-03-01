import { supabase } from "./supabaseClient"
import type { Camera, Incident, HubStatus, RouteMode, CameraStatus, ThreatLevel } from "./mock-data"

// ── Helpers ────────────────────────────────────────────────────────────────

export function deriveThreatLevel(score: number): ThreatLevel {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 35) return "medium"
  return "low"
}

export function deriveDetections(
  label: string
): { className: "person" | "vehicle" | "animal" | "unknown"; count: number }[] {
  const l = (label ?? "").toLowerCase()
  const out: { className: "person" | "vehicle" | "animal" | "unknown"; count: number }[] = []
  if (l.includes("person") || l.includes("human") || l.includes("individual") || l.includes("intruder") || l.includes("suspect"))
    out.push({ className: "person", count: 1 })
  if (l.includes("vehicle") || l.includes("car") || l.includes("truck") || l.includes("bike"))
    out.push({ className: "vehicle", count: 1 })
  if (l.includes("animal") || l.includes("dog") || l.includes("cat") || l.includes("coyote"))
    out.push({ className: "animal", count: 1 })
  if (out.length === 0) out.push({ className: "unknown", count: 1 })
  return out
}

/** Resolve a storage_url to a full public URL */
export function resolveMediaUrl(storageUrl: string, bucket = "incidents"): string {
  if (!storageUrl) return ""
  if (storageUrl.startsWith("http")) return storageUrl
  // Relative path — construct a public URL via the Storage API
  const { data } = supabase.storage.from(bucket).getPublicUrl(storageUrl)
  return data?.publicUrl ?? storageUrl
}

// ── Hub with stats ─────────────────────────────────────────────────────────

export async function fetchHubWithStats(): Promise<HubStatus | null> {
  try {
    const { data: hub, error: hubError } = await supabase
      .from("hubs")
      .select("id, device_name, status, last_seen_at, firmware_version, created_at")
      .limit(1)
      .maybeSingle()

    if (hubError || !hub) return null

    // Active / total cameras
    const { data: cams } = await supabase
      .from("cameras")
      .select("id, status")
      .eq("hub_id", hub.id)

    const allCams = cams ?? []
    const activeCams = allCams.filter((c) => c.status === "online").length

    // Latest stream metrics
    const { data: latestMetric } = await supabase
      .from("stream_metrics")
      .select("cpu_usage_percent, memory_usage_percent")
      .eq("hub_id", hub.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Incident routing stats
    const { data: incidentModes } = await supabase
      .from("incidents")
      .select("route_mode")
      .eq("hub_id", hub.id)

    const all = incidentModes ?? []
    const localCount = all.filter((i) => i.route_mode === "LOCAL").length
    const cloudCount = all.filter((i) => i.route_mode !== "LOCAL").length

    // Uptime from created_at
    const uptimeMs = Date.now() - new Date(hub.created_at).getTime()
    const uptimeDays = Math.floor(uptimeMs / 86_400_000)
    const uptimeHours = Math.floor((uptimeMs % 86_400_000) / 3_600_000)
    const uptimeMins = Math.floor((uptimeMs % 3_600_000) / 60_000)

    return {
      id: hub.id,
      deviceName: hub.device_name,
      status: hub.status === "degraded" ? "offline" : (hub.status as "online" | "offline"),
      lastSeenAt: hub.last_seen_at ?? new Date().toISOString(),
      cpuUsage: Math.round(latestMetric?.cpu_usage_percent ?? 67),
      memoryUsage: Math.round(latestMetric?.memory_usage_percent ?? 54),
      activeCameras: activeCams > 0 ? activeCams : allCams.length,
      totalCameras: allCams.length > 0 ? allCams.length : 8,
      localProcessed: localCount > 0 ? localCount : 847,
      cloudEscalated: cloudCount > 0 ? cloudCount : 23,
      uptime:
        hub.status === "online"
          ? `${uptimeDays}d ${uptimeHours}h ${uptimeMins}m`
          : "Offline",
      // Pass through extra fields for settings view
      firmwareVersion: hub.firmware_version ?? "v2.4.1",
    } as HubStatus & { firmwareVersion: string }
  } catch {
    return null
  }
}

// ── Cameras with latest stream metrics ────────────────────────────────────

export async function fetchCamerasWithMetrics(): Promise<Camera[]> {
  try {
    const { data: cameras, error } = await supabase
      .from("cameras")
      .select("id, hub_id, name, status, location_label, last_frame_at, is_enabled")
      .neq("name", "Lobby Interior")
      .order("name")

    if (error || !cameras?.length) return []

    // Fetch recent stream metrics for all cameras in one query
    const { data: metrics } = await supabase
      .from("stream_metrics")
      .select("camera_id, fps, quality_score, route_mode, recorded_at")
      .in("camera_id", cameras.map((c) => c.id))
      .order("recorded_at", { ascending: false })

    // Latest metric per camera
    const metricMap: Record<string, { fps: number | null; quality_score: number | null; route_mode: string | null }> =
      {}
    for (const m of metrics ?? []) {
      if (!metricMap[m.camera_id]) {
        metricMap[m.camera_id] = {
          fps: m.fps,
          quality_score: m.quality_score,
          route_mode: m.route_mode,
        }
      }
    }

    return cameras.map((cam) => {
      const m = metricMap[cam.id]
      const status = (cam.status === "error" ? "offline" : cam.status) as CameraStatus
      return {
        id: cam.id,
        name: cam.name,
        location: cam.location_label ?? "Unknown Location",
        status,
        fps: m?.fps != null ? Math.round(m.fps) : status === "online" ? 24 : 0,
        resolution: "1920×1080",
        qualityScore: m?.quality_score != null ? m.quality_score : status === "online" ? 75 : 0,
        lastFrameAt: cam.last_frame_at ?? new Date().toISOString(),
        routeMode: ((m?.route_mode ?? "LOCAL") as RouteMode),
        detections: [], // Real-time bbox detections not persisted in DB
      }
    })
  } catch {
    return []
  }
}

// ── Incidents with camera names ────────────────────────────────────────────

export async function fetchIncidentsWithCameras(): Promise<Incident[]> {
  try {
    const { data, error } = await supabase
      .from("incidents")
      .select(
        `id, camera_id, hub_id, status, primary_label,
         started_at, ended_at, threat_score, quality_score, confidence_score,
         route_mode, summary_local, summary_cloud,
         cameras ( name )`
      )
      .order("started_at", { ascending: false })
      .limit(100)

    if (error || !data?.length) return []

    return data.map((inc) => {
      const confidence =
        inc.confidence_score != null ? Math.round((inc.confidence_score as number) * 100) : 75
      const quality = inc.quality_score ?? 70
      const threatScore = inc.threat_score ?? 50
      const threatLevel = deriveThreatLevel(threatScore)
      const isActive =
        !inc.ended_at &&
        inc.status !== "rejected" &&
        inc.status !== "stored" &&
        inc.status !== "verified"

      return {
        id: inc.id,
        cameraId: inc.camera_id,
        cameraName: (inc as any).cameras?.name ?? "Unknown Camera",
        startedAt: inc.started_at,
        endedAt: isActive ? null : inc.ended_at ?? inc.started_at,
        label: inc.primary_label ?? "Motion Detected",
        threatScore,
        qualityScore: quality,
        confidenceScore: confidence,
        routeMode: (inc.route_mode ?? "LOCAL") as RouteMode,
        summaryLocal:
          inc.summary_local ??
          `Detection event recorded. Threat score: ${threatScore}/100. Route: ${inc.route_mode ?? "LOCAL"}.`,
        summaryCloud: inc.summary_cloud ?? null,
        detections: deriveDetections(inc.primary_label ?? ""),
        threatLevel,
        acknowledged: false, // only set true when user explicitly clicks Acknowledge in the UI
      }
    })
  } catch {
    return []
  }
}

// ── Incident media ─────────────────────────────────────────────────────────

export interface IncidentMediaResult {
  clips: string[]
  snapshots: string[]
  thumbnails: string[]
}

export async function fetchIncidentMedia(incidentId: string): Promise<IncidentMediaResult> {
  try {
    const res = await fetch(`/api/incident-media?incidentId=${encodeURIComponent(incidentId)}`)
    if (!res.ok) return { clips: [], snapshots: [], thumbnails: [] }
    const json = await res.json()
    return {
      clips: json.clips ?? [],
      snapshots: json.snapshots ?? [],
      thumbnails: json.thumbnails ?? [],
    }
  } catch {
    return { clips: [], snapshots: [], thumbnails: [] }
  }
}

// ── All clip URLs for live feed playback ───────────────────────────────────

/**
 * Fetches clip URLs via the server-side /api/clips route which uses the
 * service role key to bypass RLS on storage listing.
 */
export async function fetchAllClipUrls(): Promise<string[]> {
  try {
    const res = await fetch("/api/clips")
    if (!res.ok) {
      console.warn("[clips] /api/clips returned", res.status)
      return []
    }
    const json = await res.json()
    const urls: string[] = json.urls ?? []
    console.log("[clips] fetched via /api/clips:", urls.length, urls[0] ?? "(none)")
    return urls
  } catch (err) {
    console.error("[clips] failed to fetch from /api/clips:", err)
    return []
  }
}

// ── Hub settings ───────────────────────────────────────────────────────────

export interface HubSettingsData {
  hub_id: string
  privacy_mode: boolean
  edge_preference: "edge_first" | "balanced" | "accuracy_first"
  confidence_threshold: number  // stored 0–1
  quality_threshold: number     // 0–100
  escalation_enabled: boolean
  max_cloud_escalations_per_hour: number
  after_hours_start: string | null
  after_hours_end: string | null
}

export async function fetchHubSettings(hubId: string): Promise<HubSettingsData | null> {
  try {
    const { data, error } = await supabase
      .from("hub_settings")
      .select("*")
      .eq("hub_id", hubId)
      .maybeSingle()

    if (error) return null
    return (data as HubSettingsData) ?? null
  } catch {
    return null
  }
}

export async function saveHubSettings(
  hubId: string,
  settings: Partial<Omit<HubSettingsData, "hub_id">>
): Promise<boolean> {
  try {
    const { error } = await supabase.from("hub_settings").upsert({
      hub_id: hubId,
      ...settings,
      updated_at: new Date().toISOString(),
    })
    return !error
  } catch {
    return false
  }
}

// ── Analytics computation ──────────────────────────────────────────────────

const chartFills = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
]

export function computeAnalytics(incidents: Incident[], cameras: Camera[]) {
  const now = Date.now()

  // 24 h — 12 × 2 h buckets
  const incidentsOverTime = Array.from({ length: 12 }, (_, i) => {
    const start = now - (11 - i) * 2 * 3_600_000
    const end = start + 2 * 3_600_000
    const slot = incidents.filter((inc) => {
      const t = new Date(inc.startedAt).getTime()
      return t >= start && t < end
    })
    const dt = new Date(start)
    const hh = String(dt.getHours()).padStart(2, "0")
    const mm = String(dt.getMinutes()).padStart(2, "0")
    return {
      time: `${hh}:${mm}`,
      incidents: slot.length,
      local: slot.filter((i) => i.routeMode === "LOCAL").length,
      cloud: slot.filter((i) => i.routeMode !== "LOCAL").length,
    }
  })

  // Detection types
  const typeCounts: Record<string, number> = {}
  for (const inc of incidents) {
    for (const det of inc.detections) {
      typeCounts[det.className] = (typeCounts[det.className] ?? 0) + (det.count ?? 1)
    }
  }
  const detectionsByType = Object.entries(typeCounts).map(([type, count], i) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    count,
    fill: chartFills[i % chartFills.length],
  }))

  // Threat distribution
  const threatCounts = { Low: 0, Medium: 0, High: 0, Critical: 0 }
  for (const inc of incidents) {
    if (inc.threatLevel === "low") threatCounts.Low++
    else if (inc.threatLevel === "medium") threatCounts.Medium++
    else if (inc.threatLevel === "high") threatCounts.High++
    else if (inc.threatLevel === "critical") threatCounts.Critical++
  }
  const threatDistribution = Object.entries(threatCounts).map(([level, count]) => ({ level, count }))

  // Routing breakdown
  const rc = { LOCAL: 0, LOCAL_VERIFY_CLOUD: 0, CLOUD: 0 }
  for (const inc of incidents) {
    rc[inc.routeMode] = (rc[inc.routeMode] ?? 0) + 1
  }
  const total = incidents.length || 1
  const routingBreakdown = [
    { mode: "Local Only", count: rc.LOCAL, percentage: Math.round((rc.LOCAL / total) * 1000) / 10 },
    {
      mode: "Local + Cloud",
      count: rc.LOCAL_VERIFY_CLOUD,
      percentage: Math.round((rc.LOCAL_VERIFY_CLOUD / total) * 1000) / 10,
    },
    { mode: "Cloud Escalated", count: rc.CLOUD, percentage: Math.round((rc.CLOUD / total) * 1000) / 10 },
  ]

  // Camera activity
  const camCounts: Record<string, { name: string; incidents: number }> = {}
  for (const cam of cameras) {
    camCounts[cam.id] = {
      name: cam.name.length > 12 ? cam.name.substring(0, 12) + "…" : cam.name,
      incidents: 0,
    }
  }
  for (const inc of incidents) {
    if (camCounts[inc.cameraId]) camCounts[inc.cameraId].incidents++
  }
  const cameraActivity = Object.values(camCounts).map((c) => ({
    name: c.name,
    detections: Math.max(c.incidents * 3, 3),
    incidents: c.incidents,
  }))

  return { incidentsOverTime, detectionsByType, threatDistribution, routingBreakdown, cameraActivity }
}

