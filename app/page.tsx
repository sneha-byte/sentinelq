"use client";

import { useState } from "react";
import { TopHeader } from "@/components/top-header";
import { DashboardView } from "@/components/dashboard-view";
import { CamerasView } from "@/components/cameras-view";
import { IncidentsView } from "@/components/incidents-view";
import { AnalyticsView } from "@/components/analytics-view";
import { SettingsView } from "@/components/settings-view";
import { NeighborsView } from "@/components/neighbors-view";
import { LayoutDashboard, Camera, ShieldAlert, Users, BarChart2, Settings } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Home",      Icon: LayoutDashboard },
  { id: "cameras",   label: "Cameras",   Icon: Camera },
  { id: "incidents", label: "Incidents", Icon: ShieldAlert },
  { id: "neighbors", label: "Neighbors", Icon: Users },
  { id: "analytics", label: "Analytics", Icon: BarChart2 },
  { id: "settings",  label: "Settings",  Icon: Settings },
];

export default function SentinelQDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopHeader activeTab={activeTab} onNavigate={setActiveTab} />

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
        <div className="mx-auto max-w-5xl px-4 py-5">
          {activeTab === "dashboard" && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === "cameras"   && <CamerasView />}
          {activeTab === "incidents" && <IncidentsView />}
          {activeTab === "analytics" && <AnalyticsView />}
          {activeTab === "neighbors" && <NeighborsView />}
          {activeTab === "settings"  && <SettingsView />}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-card md:hidden">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          const isAlert = id === "incidents";
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors
                ${active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
              {label}
              {/* Red dot on Incidents if there's an active alert */}
              {isAlert && !active && (
                <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Desktop side nav — hidden on mobile */}
      <nav className="fixed left-0 top-14 hidden h-[calc(100vh-3.5rem)] w-52 flex-col gap-1 border-r border-border bg-card p-3 md:flex">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left
                ${active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Desktop: push content right of sidebar */}
      <style>{`
        @media (min-width: 768px) {
          main { margin-left: 13rem; }
        }
      `}</style>
    </div>
  );
}