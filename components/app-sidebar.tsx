"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Camera,
  AlertTriangle,
  BarChart3,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "cameras", label: "Cameras", icon: Camera },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "neighbors", label: "Neighbors", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex w-[68px] flex-col items-center border-r border-border bg-card py-5">
        {/* Logo */}
        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Shield className="h-5 w-5" />
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    {item.id === "incidents" && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                        1
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Status dot at bottom */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-3 w-3 items-center justify-center">
                <span className="h-2.5 w-2.5 rounded-full bg-success animate-live" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              Hub Online
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
