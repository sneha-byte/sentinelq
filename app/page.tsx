"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { TopHeader } from "@/components/top-header";
import { DashboardView } from "@/components/dashboard-view";
import { CamerasView } from "@/components/cameras-view";
import { IncidentsView } from "@/components/incidents-view";
import { AnalyticsView } from "@/components/analytics-view";
import { SettingsView } from "@/components/settings-view";
import { NeighborsView } from "@/components/neighbors-view";
import { useDashboardData } from "@/hooks/use-dashboard-data";

export default function SentinelQDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { hub, cameras, incidents, analytics, clipUrls, loading } = useDashboardData();

  // ── Shared persistent state (survives tab switches) ────────────────────────
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [alertSent,    setAlertSent]    = useState<Set<string>>(new Set());
  const [lightStates,  setLightStates]  = useState<Record<string, boolean>>({});
  const [autoMotion,   setAutoMotion]   = useState<Record<string, boolean>>({});

  function acknowledge(id: string)      { setAcknowledged(prev => new Set([...prev, id])); }
  function sendAlert(id: string)        { setAlertSent(prev => new Set([...prev, id])); }
  function toggleLight(id: string)      { setLightStates(prev => ({ ...prev, [id]: !prev[id] })); }
  function toggleAutoMotion(id: string) { setAutoMotion(prev => ({ ...prev, [id]: !prev[id] })); }

  const unresolvedCount = incidents.filter(
    i => !i.endedAt && !i.acknowledged && !acknowledged.has(i.id)
  ).length;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} unresolvedCount={unresolvedCount} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopHeader unresolvedCount={unresolvedCount} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* All tabs rendered always — hidden with CSS so state is preserved */}
            <div className={activeTab === "dashboard" ? "" : "hidden"}>
              <DashboardView
                onNavigate={setActiveTab}
                cameras={cameras}
                incidents={incidents}
                clipUrls={clipUrls}
              />
            </div>
            <div className={activeTab === "cameras" ? "" : "hidden"}>
              <CamerasView
                cameras={cameras}
                incidents={incidents}
                clipUrls={clipUrls}
                lightStates={lightStates}
                autoMotion={autoMotion}
                onToggleLight={toggleLight}
                onToggleAutoMotion={toggleAutoMotion}
              />
            </div>
            <div className={activeTab === "incidents" ? "" : "hidden"}>
              <IncidentsView
                incidents={incidents}
                acknowledged={acknowledged}
                alertSent={alertSent}
                onAcknowledge={acknowledge}
                onAlertSent={sendAlert}
              />
            </div>
            <div className={activeTab === "neighbors" ? "" : "hidden"}>
              <NeighborsView />
            </div>
            <div className={activeTab === "analytics" ? "" : "hidden"}>
              <AnalyticsView analytics={analytics} />
            </div>
            <div className={activeTab === "settings" ? "" : "hidden"}>
              <SettingsView hub={hub} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
