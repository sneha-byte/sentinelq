"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  fetchHubWithStats,
  fetchCamerasWithMetrics,
  fetchIncidentsWithCameras,
  fetchAllClipUrls,
  computeAnalytics,
} from "@/lib/supabase-data"
import type { Camera, Incident, HubStatus } from "@/lib/mock-data"
import { hub as mockHub } from "@/lib/mock-data"

export type DashboardAnalytics = ReturnType<typeof computeAnalytics>

export function useDashboardData() {
  const [hub, setHub] = useState<HubStatus>(mockHub)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(computeAnalytics([], []))
  const [clipUrls, setClipUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [usingRealData, setUsingRealData] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [hubData, camerasData, incidentsData, clips] = await Promise.all([
        fetchHubWithStats(),
        fetchCamerasWithMetrics(),
        fetchIncidentsWithCameras(),
        fetchAllClipUrls(),
      ])

      if (clips.length > 0) setClipUrls(clips)

      if (hubData) setHub(hubData)

      setCameras(camerasData)
      setIncidents(incidentsData)
      setAnalytics(computeAnalytics(incidentsData, camerasData))
      setUsingRealData(camerasData.length > 0 || incidentsData.length > 0)
    } catch (err) {
      console.warn("[SentinelQ] Supabase fetch failed:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    // Real-time subscriptions
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

    const metricCh = supabase
      .channel("sq-stream-metrics")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stream_metrics" }, refresh)
      .subscribe()

    return () => {
      supabase.removeChannel(incidentCh)
      supabase.removeChannel(cameraCh)
      supabase.removeChannel(hubCh)
      supabase.removeChannel(metricCh)
    }
  }, [refresh])

  return { hub, cameras, incidents, analytics, clipUrls, loading, usingRealData, refresh }
}

