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
import { AIAssistantView } from "@/components/ai-assistant-view";
import { SmartHomeView } from "@/components/smart-home-preview";
import { incidents as mockIncidents } from "@/lib/mock-data";

export default function SentinelQDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // ── Shared persistent state ───────────────────────────────────────────────
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [alertSent,    setAlertSent]    = useState<Set<string>>(new Set());
  const [lightStates,  setLightStates]  = useState<Record<string, boolean>>({});
  const [autoMotion,   setAutoMotion]   = useState<Record<string, boolean>>({});

  function acknowledge(id: string)      { setAcknowledged(prev => new Set([...prev, id])); }
  function sendAlert(id: string)        { setAlertSent(prev => new Set([...prev, id])); }
  function toggleLight(id: string)      { setLightStates(prev => ({ ...prev, [id]: !prev[id] })); }
  function toggleAutoMotion(id: string) { setAutoMotion(prev => ({ ...prev, [id]: !prev[id] })); }

  const unresolvedCount = mockIncidents.filter(
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
              <DashboardView onNavigate={setActiveTab} />
            </div>
            <div className={activeTab === "cameras" ? "" : "hidden"}>
              <CamerasView
                lightStates={lightStates}
                autoMotion={autoMotion}
                onToggleLight={toggleLight}
                onToggleAutoMotion={toggleAutoMotion}
              />
            </div>
            <div className={activeTab === "incidents" ? "" : "hidden"}>
              <IncidentsView
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
              <AnalyticsView />
            </div>
            <div className={activeTab === "settings" ? "" : "hidden"}>
              <SettingsView />
            </div>
            <div className={activeTab === "smarthome" ? "" : "hidden"}>
              <SmartHomeView />
            </div>
            <div className={activeTab === "ai" ? "" : "hidden"}>
              <AIAssistantView />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}