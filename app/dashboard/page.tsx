"use client";

import { useEffect, useState } from "react";
import { fetchHubs, fetchIncidents } from "@/lib/data";

export default function DashboardPage() {
  const [hubs, setHubs] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [h, i] = await Promise.all([fetchHubs(), fetchIncidents()]);
        setHubs(h);
        setIncidents(i);
      } catch (e: any) {
        setError(e.message ?? "Failed to load data");
      }
    })();
  }, []);

  if (error) return <div style={{ padding: 24 }}>Error: {error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <h2>Hubs</h2>
      <pre>{JSON.stringify(hubs, null, 2)}</pre>

      <h2>Incidents</h2>
      <pre>{JSON.stringify(incidents, null, 2)}</pre>
    </div>
  );
}
