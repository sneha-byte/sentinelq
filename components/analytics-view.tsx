"use client"

import { analyticsData, incidents, getThreatScore10 } from "@/lib/mock-data"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { TrendingUp, Cpu, Cloud, ShieldAlert, Target } from "lucide-react"

const COLORS = ["#2c6e49","#b83232","#c07800","#3a5fa0","#8b5cf6"]

// Confidence distribution buckets
const confidenceBuckets = [
  { range: "90-100%", count: incidents.filter(i => i.confidenceScore >= 90).length },
  { range: "70-89%",  count: incidents.filter(i => i.confidenceScore >= 70 && i.confidenceScore < 90).length },
  { range: "50-69%",  count: incidents.filter(i => i.confidenceScore >= 50 && i.confidenceScore < 70).length },
  { range: "< 50%",   count: incidents.filter(i => i.confidenceScore < 50).length },
]

// Average confidence per camera
const confidencePerCamera = Array.from(
  incidents.reduce((map, inc) => {
    if (!map.has(inc.cameraName)) map.set(inc.cameraName, [])
    map.get(inc.cameraName)!.push(inc.confidenceScore)
    return map
  }, new Map<string, number[]>())
).map(([name, scores]) => ({
  name: name.length > 14 ? name.substring(0, 14) + "…" : name,
  avgConfidence: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
}))

const avgOverall = Math.round(
  incidents.reduce((a, i) => a + i.confidenceScore, 0) / incidents.length
)

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground/70">{sub}</p>}
      </div>
    </div>
  )
}

export function AnalyticsView() {
  return (
    <div className="flex flex-col gap-6">

      {/* ── Top stats ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShieldAlert} label="Total Incidents"  value={incidents.length}        sub="Last 24 hours"      color="bg-destructive/10 text-destructive" />
        <StatCard icon={Cpu}         label="Edge Processed"   value="97.4%"                   sub="847 local inferences" color="bg-success/10 text-success" />
        <StatCard icon={Cloud}       label="Cloud Escalated"  value="23"                      sub="2.6% of total"      color="bg-primary/10 text-primary" />
        <StatCard icon={Target}      label="Avg Confidence"   value={`${avgOverall}%`}         sub="Across all cameras" color="bg-warning/10 text-warning" />
      </div>

      {/* ── Incidents over time ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Incidents Over Time</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={analyticsData.incidentsOverTime}>
            <defs>
              <linearGradient id="localGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2c6e49" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#2c6e49" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3a5fa0" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3a5fa0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="local" name="Edge" stroke="#2c6e49" fill="url(#localGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="cloud" name="Cloud" stroke="#3a5fa0" fill="url(#cloudGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Confidence section ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Confidence distribution */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Confidence Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={confidenceBuckets} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v} incidents`, "Count"]} />
              <Bar dataKey="count" name="Incidents" radius={[6,6,0,0]}>
                {confidenceBuckets.map((_, i) => (
                  <Cell key={i} fill={["#2c6e49","#c07800","#b83232","#94a3b8"][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Overall average: <span className="font-bold text-foreground">{avgOverall}%</span>
          </p>
        </div>

        {/* Confidence per camera */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Avg Confidence per Camera</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={confidencePerCamera} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" domain={[0,100]} tick={{ fontSize:11 }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fontSize:10 }} width={100} />
              <Tooltip formatter={v => [`${v}%`, "Avg Confidence"]} />
              <Bar dataKey="avgConfidence" name="Confidence" radius={[0,6,6,0]}>
                {confidencePerCamera.map((entry, i) => (
                  <Cell key={i} fill={entry.avgConfidence >= 80 ? "#2c6e49" : entry.avgConfidence >= 60 ? "#c07800" : "#b83232"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Detection types + threat distribution ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Detections by Type</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={analyticsData.detectionsByType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={70} label={({ type, percent }) => `${type} ${(percent*100).toFixed(0)}%`}>
                {analyticsData.detectionsByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Threat Level Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analyticsData.threatDistribution} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="level" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Incidents" radius={[6,6,0,0]}>
                {analyticsData.threatDistribution.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.level === "Critical" ? "#b83232" :
                    entry.level === "High"     ? "#e05c5c" :
                    entry.level === "Medium"   ? "#c07800" : "#2c6e49"
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Routing breakdown ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Inference Routing</h3>
        <div className="flex flex-col gap-3">
          {analyticsData.routingBreakdown.map(r => (
            <div key={r.mode} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-sm text-foreground">{r.mode}</span>
              <div className="flex-1 rounded-full bg-secondary h-2.5 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${r.percentage}%` }} />
              </div>
              <span className="w-12 text-right text-sm font-bold text-foreground">{r.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}