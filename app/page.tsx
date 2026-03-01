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

export default function SentinelQDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopHeader />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {activeTab === "dashboard" && (
              <DashboardView onNavigate={setActiveTab} />
            )}
            {activeTab === "cameras" && <CamerasView />}
            {activeTab === "incidents" && <IncidentsView />}
            {activeTab === "neighbors" && <NeighborsView />}
            {activeTab === "analytics" && <AnalyticsView />}
            {activeTab === "settings" && <SettingsView />}
          </div>
        </main>
      </div>
    </div>
  );
}
