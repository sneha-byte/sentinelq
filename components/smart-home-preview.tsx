"use client";

import { cn } from "@/lib/utils";
import { Home, Lightbulb, Lock, Car, Thermometer, Bot, Sparkles, Bell, Zap, Shield } from "lucide-react";

const AUTOMATIONS = [
  { icon: Lightbulb, label: "Occupancy Simulation",  status: "active",   color: "text-yellow-500", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
  { icon: Lock,      label: "Auto Door Lock",         status: "active",   color: "text-success",    bg: "bg-success/10",    border: "border-success/20" },
  { icon: Car,       label: "Garage Auto-Close",      status: "learning", color: "text-primary",    bg: "bg-primary/10",    border: "border-primary/20" },
  { icon: Thermometer, label: "Climate Control",      status: "soon",     color: "text-muted-foreground", bg: "bg-secondary/50", border: "border-border" },
  { icon: Bell,      label: "Visitor Notifications",  status: "soon",     color: "text-muted-foreground", bg: "bg-secondary/50", border: "border-border" },
  { icon: Shield,    label: "Perimeter Awareness",    status: "soon",     color: "text-muted-foreground", bg: "bg-secondary/50", border: "border-border" },
];

const ACTIVITY = [
  { time: "8:47pm",  event: "Porch light turned on at sunset",           tag: "Pending",  tagColor: "bg-primary/10 text-primary" },
  { time: "11:07pm", event: "Front door locked - all residents away",    tag: "Learned",  tagColor: "bg-success/10 text-success" },
  { time: "11:12pm", event: "Living room lights off after 11pm",         tag: "Pending",  tagColor: "bg-primary/10 text-primary" },
  { time: "7:02am",  event: "Thermostat raised - occupancy detected",    tag: "Auto",     tagColor: "bg-secondary text-muted-foreground" },
];

export function SmartHomeView() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/8 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Home className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-foreground">Smart Home</h2>
              <span className="flex items-center gap-1 rounded-full bg-warning/10 border border-warning/20 px-2.5 py-0.5 text-xs font-semibold text-warning">
                <Sparkles className="h-3 w-3" /> Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Automations */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Planned Automations</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {AUTOMATIONS.map(({ icon: Icon, label, status, color, bg, border }) => (
            <div key={label} className={cn("rounded-xl border p-3.5 flex items-center gap-3", bg, border)}>
              <Icon className={cn("h-4 w-4 shrink-0", color)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{label}</p>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wide",
                  status === "active" ? "text-success" : status === "learning" ? "text-primary" : "text-muted-foreground"
                )}>
                  {status === "active" ? "Active" : status === "learning" ? "Learning" : "Planned"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sample log */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sample Activity Log</p>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {ACTIVITY.map((item, i) => (
            <div key={i} className={cn("flex items-center gap-4 px-4 py-3", i < ACTIVITY.length - 1 && "border-b border-border")}>
              <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">{item.time}</span>
              <p className="text-sm text-foreground flex-1">{item.event}</p>
              <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold", item.tagColor)}>{item.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI link */}
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 flex items-center gap-3">
        <Bot className="h-5 w-5 text-primary shrink-0" />
        <p className="text-sm text-foreground flex-1">Powered by the <span className="font-semibold">AI Assistant</span> - tell it your schedule and it adapts in real time.</p>
        <Zap className="h-4 w-4 text-primary shrink-0" />
      </div>
    </div>
  );
}