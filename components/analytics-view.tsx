"use client";

import { analyticsData as mockAnalytics } from "@/lib/mock-data";
import type { DashboardAnalytics } from "@/hooks/use-dashboard-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const chartColors = {
  primary: "#6366f1",
  teal: "#14b8a6",
  amber: "#f59e0b",
  rose: "#ef4444",
  muted: "#94a3b8",
  grid: "#e2e8f0",
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

interface AnalyticsViewProps {
  analytics?: DashboardAnalytics;
}

export function AnalyticsView({ analytics = mockAnalytics as DashboardAnalytics }: AnalyticsViewProps) {
  const {
    incidentsOverTime,
    detectionsByType,
    threatDistribution,
    routingBreakdown,
    cameraActivity,
  } = analytics;

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <h2 className="text-base font-semibold text-foreground">Analytics</h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Incidents Over Time */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              Incidents Over Time (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incidentsOverTime}>
                  <defs>
                    <linearGradient id="gradLocal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCloud" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.teal} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={chartColors.teal} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: chartColors.muted }}
                    stroke={chartColors.grid}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartColors.muted }}
                    stroke={chartColors.grid}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="local"
                    stackId="1"
                    stroke={chartColors.primary}
                    fill="url(#gradLocal)"
                    strokeWidth={2}
                    name="Edge"
                  />
                  <Area
                    type="monotone"
                    dataKey="cloud"
                    stackId="1"
                    stroke={chartColors.teal}
                    fill="url(#gradCloud)"
                    strokeWidth={2}
                    name="Cloud"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Detection Types */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              Detections by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={detectionsByType}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {detectionsByType.map((_, index) => {
                      const fills = [
                        chartColors.primary,
                        chartColors.teal,
                        chartColors.amber,
                        chartColors.rose,
                      ];
                      return <Cell key={index} fill={fills[index % fills.length]} />;
                    })}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-4">
              {detectionsByType.map((d, i) => {
                const fills = [
                  chartColors.primary,
                  chartColors.teal,
                  chartColors.amber,
                  chartColors.rose,
                ];
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: fills[i % fills.length] }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {d.type}: {d.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Threat Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Threat Levels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatDistribution} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartColors.grid}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: chartColors.muted }}
                    stroke={chartColors.grid}
                  />
                  <YAxis
                    dataKey="level"
                    type="category"
                    tick={{ fontSize: 11, fill: chartColors.muted }}
                    stroke={chartColors.grid}
                    width={55}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Incidents" radius={[0, 6, 6, 0]}>
                    {threatDistribution.map((_, index) => {
                      const fills = [
                        chartColors.teal,
                        chartColors.amber,
                        chartColors.rose,
                        "#dc2626",
                      ];
                      return <Cell key={index} fill={fills[index % fills.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Routing Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              Inference Routing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5">
              {routingBreakdown.map((r, i) => {
                const fills = [chartColors.teal, chartColors.amber, chartColors.primary];
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-foreground">{r.mode}</span>
                      <span className="text-sm font-semibold text-foreground">
                        {r.percentage}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${r.percentage}%`, backgroundColor: fills[i] }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.count} inferences</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Camera Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Camera Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cameraActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: chartColors.muted }}
                    stroke={chartColors.grid}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartColors.muted }}
                    stroke={chartColors.grid}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="detections"
                    name="Detections"
                    fill={chartColors.primary}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="incidents"
                    name="Incidents"
                    fill={chartColors.teal}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
