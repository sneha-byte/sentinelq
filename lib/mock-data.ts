// Mock data for SentinelQ dashboard

export type CameraStatus = "online" | "offline" | "degraded"
export type RouteMode = "LOCAL" | "LOCAL_VERIFY_CLOUD" | "CLOUD"
export type ThreatLevel = "low" | "medium" | "high" | "critical"
export type DetectionClass = "person" | "vehicle" | "animal" | "unknown"

export interface Camera {
  id: string
  name: string
  location: string
  status: CameraStatus
  fps: number
  resolution: string
  qualityScore: number
  lastFrameAt: string
  detections: Detection[]
  routeMode: RouteMode
}

export interface Detection {
  id: string
  className: DetectionClass
  confidence: number
  bbox: { x: number; y: number; w: number; h: number }
  trackId: string
  timestamp: string
}

export interface Incident {
  id: string
  cameraId: string
  cameraName: string
  startedAt: string
  endedAt: string | null
  label: string
  threatScore: number        // 0–100 internally
  qualityScore: number
  confidenceScore: number
  routeMode: RouteMode
  summaryLocal: string
  summaryCloud: string | null
  detections: { className: DetectionClass; count: number }[]
  threatLevel: ThreatLevel
  acknowledged: boolean
}

export interface HubStatus {
  id: string
  deviceName: string
  status: "online" | "offline"
  lastSeenAt: string
  cpuUsage: number
  memoryUsage: number
  activeCameras: number
  totalCameras: number
  localProcessed: number
  cloudEscalated: number
  uptime: string
}

// ── Helper: convert 0–100 threat score to 1–10 display ──────────────────────
export function getThreatScore10(score: number): number {
  return Math.max(1, Math.min(10, Math.round(score / 10)))
}

// ── Helper: derive threat level from 1–10 score ──────────────────────────────
export function getThreatLevelFrom10(score10: number): ThreatLevel {
  if (score10 >= 9) return "critical"
  if (score10 >= 7) return "high"
  if (score10 >= 4) return "medium"
  return "low"
}

export const hub: HubStatus = {
  id: "hub-001",
  deviceName: "SentinelQ Edge Hub Alpha",
  status: "online",
  lastSeenAt: new Date().toISOString(),
  cpuUsage: 67,
  memoryUsage: 54,
  activeCameras: 6,
  totalCameras: 8,
  localProcessed: 847,
  cloudEscalated: 23,
  uptime: "14d 7h 32m",
}

export const cameras: Camera[] = [
  {
    id: "cam-001",
    name: "Front Entrance",
    location: "Main Building - North",
    status: "online",
    fps: 30,
    resolution: "1920x1080",
    qualityScore: 92,
    lastFrameAt: new Date().toISOString(),
    routeMode: "LOCAL",
    detections: [
      { id: "d1", className: "person", confidence: 0.94, bbox: { x: 0.3, y: 0.2, w: 0.12, h: 0.45 }, trackId: "t1", timestamp: new Date().toISOString() },
      { id: "d2", className: "person", confidence: 0.87, bbox: { x: 0.6, y: 0.25, w: 0.1, h: 0.4 }, trackId: "t2", timestamp: new Date().toISOString() },
    ],
  },
  {
    id: "cam-002",
    name: "Parking Lot A",
    location: "Exterior - West",
    status: "online",
    fps: 24,
    resolution: "1920x1080",
    qualityScore: 78,
    lastFrameAt: new Date().toISOString(),
    routeMode: "LOCAL",
    detections: [
      { id: "d3", className: "vehicle", confidence: 0.96, bbox: { x: 0.1, y: 0.4, w: 0.25, h: 0.2 }, trackId: "t3", timestamp: new Date().toISOString() },
      { id: "d4", className: "vehicle", confidence: 0.91, bbox: { x: 0.5, y: 0.35, w: 0.2, h: 0.18 }, trackId: "t4", timestamp: new Date().toISOString() },
      { id: "d5", className: "person", confidence: 0.72, bbox: { x: 0.4, y: 0.3, w: 0.08, h: 0.35 }, trackId: "t5", timestamp: new Date().toISOString() },
    ],
  },
  {
    id: "cam-003",
    name: "Rear Loading Dock",
    location: "Main Building - South",
    status: "online",
    fps: 30,
    resolution: "1280x720",
    qualityScore: 85,
    lastFrameAt: new Date().toISOString(),
    routeMode: "LOCAL_VERIFY_CLOUD",
    detections: [
      { id: "d6", className: "person", confidence: 0.58, bbox: { x: 0.45, y: 0.5, w: 0.1, h: 0.38 }, trackId: "t6", timestamp: new Date().toISOString() },
    ],
  },
  {
    id: "cam-004",
    name: "Server Room",
    location: "Building B - Basement",
    status: "online",
    fps: 15,
    resolution: "1280x720",
    qualityScore: 95,
    lastFrameAt: new Date().toISOString(),
    routeMode: "LOCAL",
    detections: [],
  },
  {
    id: "cam-005",
    name: "Perimeter Fence East",
    location: "Exterior - East",
    status: "online",
    fps: 24,
    resolution: "1920x1080",
    qualityScore: 65,
    lastFrameAt: new Date().toISOString(),
    routeMode: "CLOUD",
    detections: [
      { id: "d7", className: "animal", confidence: 0.73, bbox: { x: 0.7, y: 0.6, w: 0.08, h: 0.12 }, trackId: "t7", timestamp: new Date().toISOString() },
    ],
  },
  {
    id: "cam-006",
    name: "Lobby Interior",
    location: "Main Building - Ground Floor",
    status: "online",
    fps: 30,
    resolution: "1920x1080",
    qualityScore: 97,
    lastFrameAt: new Date().toISOString(),
    routeMode: "LOCAL",
    detections: [
      { id: "d8", className: "person", confidence: 0.98, bbox: { x: 0.2, y: 0.15, w: 0.11, h: 0.5 }, trackId: "t8", timestamp: new Date().toISOString() },
      { id: "d9", className: "person", confidence: 0.95, bbox: { x: 0.5, y: 0.2, w: 0.1, h: 0.45 }, trackId: "t9", timestamp: new Date().toISOString() },
      { id: "d10", className: "person", confidence: 0.89, bbox: { x: 0.75, y: 0.22, w: 0.09, h: 0.42 }, trackId: "t10", timestamp: new Date().toISOString() },
    ],
  },
  {
    id: "cam-007",
    name: "Side Alley",
    location: "Exterior - North Alley",
    status: "degraded",
    fps: 10,
    resolution: "640x480",
    qualityScore: 38,
    lastFrameAt: new Date(Date.now() - 120000).toISOString(),
    routeMode: "CLOUD",
    detections: [
      { id: "d11", className: "unknown", confidence: 0.34, bbox: { x: 0.55, y: 0.4, w: 0.15, h: 0.3 }, trackId: "t11", timestamp: new Date().toISOString() },
    ],
  },
  {
    id: "cam-008",
    name: "Emergency Exit B",
    location: "Building B - Level 1",
    status: "offline",
    fps: 0,
    resolution: "1280x720",
    qualityScore: 0,
    lastFrameAt: new Date(Date.now() - 3600000).toISOString(),
    routeMode: "LOCAL",
    detections: [],
  },
]

export const incidents: Incident[] = [
  {
    id: "inc-001",
    cameraId: "cam-003",
    cameraName: "Rear Loading Dock",
    startedAt: new Date(Date.now() - 180000).toISOString(),
    endedAt: null,
    label: "Unidentified Person - Restricted Zone",
    threatScore: 82,
    qualityScore: 68,
    confidenceScore: 58,
    routeMode: "LOCAL_VERIFY_CLOUD",
    summaryLocal: "A person remained near the rear loading dock in a restricted zone after hours under moderate visibility. Loitering behavior detected with 82-second dwell time.",
    summaryCloud: "Cloud verification confirms human presence with potential loitering behavior. Individual appears to be examining the loading dock door mechanism. Clothing matches no known personnel profiles.",
    detections: [{ className: "person", count: 1 }],
    threatLevel: "high",
    acknowledged: false,
  },
  {
    id: "inc-002",
    cameraId: "cam-007",
    cameraName: "Side Alley",
    startedAt: new Date(Date.now() - 600000).toISOString(),
    endedAt: new Date(Date.now() - 300000).toISOString(),
    label: "Unclassified Object - Low Visibility",
    threatScore: 65,
    qualityScore: 38,
    confidenceScore: 34,
    routeMode: "CLOUD",
    summaryLocal: "Unidentified object detected in low-visibility area. Local analysis unable to classify with sufficient confidence.",
    summaryCloud: "Cloud analysis identifies the object as a large stray animal moving through the alley corridor. No human threat detected.",
    detections: [{ className: "unknown", count: 1 }],
    threatLevel: "medium",
    acknowledged: true,
  },
  {
    id: "inc-003",
    cameraId: "cam-002",
    cameraName: "Parking Lot A",
    startedAt: new Date(Date.now() - 1800000).toISOString(),
    endedAt: new Date(Date.now() - 1500000).toISOString(),
    label: "After-Hours Vehicle Entry",
    threatScore: 45,
    qualityScore: 78,
    confidenceScore: 96,
    routeMode: "LOCAL",
    summaryLocal: "Vehicle entered parking lot outside of normal operating hours. License plate partially obscured. Single occupant detected exiting vehicle.",
    summaryCloud: null,
    detections: [{ className: "vehicle", count: 1 }, { className: "person", count: 1 }],
    threatLevel: "medium",
    acknowledged: true,
  },
  {
    id: "inc-004",
    cameraId: "cam-005",
    cameraName: "Perimeter Fence East",
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    endedAt: new Date(Date.now() - 3300000).toISOString(),
    label: "Animal Detected Near Perimeter",
    threatScore: 12,
    qualityScore: 65,
    confidenceScore: 73,
    routeMode: "CLOUD",
    summaryLocal: "Motion detected near perimeter fence. Local classification: possible animal.",
    summaryCloud: "Confirmed: medium-sized animal (likely coyote) traversing the perimeter fence line. No security risk.",
    detections: [{ className: "animal", count: 1 }],
    threatLevel: "low",
    acknowledged: true,
  },
  {
    id: "inc-005",
    cameraId: "cam-001",
    cameraName: "Front Entrance",
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    endedAt: new Date(Date.now() - 6900000).toISOString(),
    label: "Multiple Persons - After Hours",
    threatScore: 55,
    qualityScore: 92,
    confidenceScore: 94,
    routeMode: "LOCAL",
    summaryLocal: "Three individuals detected at front entrance after business hours. Walking in formation, pausing at entrance for 45 seconds before departing.",
    summaryCloud: null,
    detections: [{ className: "person", count: 3 }],
    threatLevel: "medium",
    acknowledged: true,
  },
  {
    id: "inc-006",
    cameraId: "cam-006",
    cameraName: "Lobby Interior",
    startedAt: new Date(Date.now() - 14400000).toISOString(),
    endedAt: new Date(Date.now() - 14100000).toISOString(),
    label: "Routine Person Detection",
    threatScore: 8,
    qualityScore: 97,
    confidenceScore: 98,
    routeMode: "LOCAL",
    summaryLocal: "Standard foot traffic in lobby area during business hours. All detected individuals match expected patterns.",
    summaryCloud: null,
    detections: [{ className: "person", count: 5 }],
    threatLevel: "low",
    acknowledged: true,
  },
]

export const analyticsData = {
  incidentsOverTime: [
    { time: "00:00", incidents: 2, local: 2, cloud: 0 },
    { time: "02:00", incidents: 1, local: 1, cloud: 0 },
    { time: "04:00", incidents: 0, local: 0, cloud: 0 },
    { time: "06:00", incidents: 3, local: 2, cloud: 1 },
    { time: "08:00", incidents: 8, local: 6, cloud: 2 },
    { time: "10:00", incidents: 12, local: 9, cloud: 3 },
    { time: "12:00", incidents: 15, local: 11, cloud: 4 },
    { time: "14:00", incidents: 10, local: 8, cloud: 2 },
    { time: "16:00", incidents: 7, local: 5, cloud: 2 },
    { time: "18:00", incidents: 14, local: 10, cloud: 4 },
    { time: "20:00", incidents: 9, local: 6, cloud: 3 },
    { time: "22:00", incidents: 5, local: 4, cloud: 1 },
  ],
  detectionsByType: [
    { type: "Person",  count: 342, fill: "var(--color-chart-1)" },
    { type: "Vehicle", count: 128, fill: "var(--color-chart-2)" },
    { type: "Animal",  count: 47,  fill: "var(--color-chart-3)" },
    { type: "Unknown", count: 18,  fill: "var(--color-chart-4)" },
  ],
  threatDistribution: [
    { level: "Low",      count: 312 },
    { level: "Medium",   count: 145 },
    { level: "High",     count: 28  },
    { level: "Critical", count: 3   },
  ],
  routingBreakdown: [
    { mode: "Local Only",      count: 847, percentage: 97.4 },
    { mode: "Local + Cloud",   count: 15,  percentage: 1.7  },
    { mode: "Cloud Escalated", count: 8,   percentage: 0.9  },
  ],
  cameraActivity: cameras.map(c => ({
    name: c.name.length > 12 ? c.name.substring(0, 12) + "..." : c.name,
    detections: Math.floor(Math.random() * 100) + 10,
    incidents: Math.floor(Math.random() * 20),
  })),
}

export function getThreatColor(level: ThreatLevel) {
  switch (level) {
    case "low":      return "text-success"
    case "medium":   return "text-warning"
    case "high":     return "text-destructive"
    case "critical": return "text-destructive"
  }
}

export function getThreatBgColor(level: ThreatLevel) {
  switch (level) {
    case "low":      return "bg-success/10 text-success border-success/20"
    case "medium":   return "bg-warning/10 text-warning border-warning/20"
    case "high":     return "bg-destructive/10 text-destructive border-destructive/20"
    case "critical": return "bg-destructive/20 text-destructive border-destructive/40"
  }
}

export function getRouteColor(mode: RouteMode) {
  switch (mode) {
    case "LOCAL":              return "bg-success/10 text-success border-success/20"
    case "LOCAL_VERIFY_CLOUD": return "bg-warning/10 text-warning border-warning/20"
    case "CLOUD":              return "bg-chart-2/10 text-chart-2 border-chart-2/20"
  }
}

export function getStatusColor(status: CameraStatus) {
  switch (status) {
    case "online":   return "bg-success"
    case "degraded": return "bg-warning"
    case "offline":  return "bg-destructive"
  }
}