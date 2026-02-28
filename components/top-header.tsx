"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";

export function TopHeader() {
  const [currentTime, setCurrentTime] = useState<string | null>(null);

  useEffect(() => {
    const format = () =>
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setCurrentTime(format());
    const interval = setInterval(() => setCurrentTime(format()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-3">
      <div>
        <h1 className="text-lg font-semibold text-foreground tracking-tight">
          SentinelQ
        </h1>
        <p className="text-xs text-muted-foreground">
          Edge-to-Cloud AI Surveillance
        </p>
      </div>

      <div className="flex items-center gap-3">
        {currentTime && (
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-live" />
            <span className="font-mono">{currentTime}</span>
          </div>
        )}

        <button className="relative rounded-lg bg-secondary p-2 text-muted-foreground transition-colors hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
            1
          </span>
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          OP
        </div>
      </div>
    </header>
  );
}
