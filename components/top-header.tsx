"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { incidents as mockIncidents } from "@/lib/mock-data";

interface TopHeaderProps {
  unresolvedCount: number;
}

export function TopHeader({ unresolvedCount }: TopHeaderProps) {
  const [currentTime,  setCurrentTime]  = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const format = () =>
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setCurrentTime(format());
    const interval = setInterval(() => setCurrentTime(format()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeIncidents = mockIncidents.filter(i => !i.endedAt && !i.acknowledged);

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-3">
      <div>
        <h1 className="text-lg font-semibold text-foreground tracking-tight">SentinelQ</h1>
        <p className="text-xs text-muted-foreground">Edge-to-Cloud AI Surveillance</p>
      </div>

      <div className="flex items-center gap-3">
        {currentTime && (
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-live" />
            <span className="font-mono">{currentTime}</span>
          </div>
        )}

        {/* Bell with live count */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(o => !o)}
            className="relative rounded-lg bg-secondary p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {unresolvedCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                {unresolvedCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-border bg-card shadow-lg">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
              </div>
              {unresolvedCount === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">
                  All incidents acknowledged. Nothing to action.
                </div>
              ) : (
                activeIncidents.map(i => (
                  <div key={i.id} className="flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-0">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{i.label}</p>
                      <p className="text-xs text-muted-foreground">{i.cameraName}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          OP
        </div>
      </div>
    </header>
  );
}