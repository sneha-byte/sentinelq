"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SupabaseTestPage() {
  useEffect(() => {
    (async () => {
      console.log("URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log(
        "KEY PREFIX",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 12),
      );

      // incidents
      const incRes = await supabase
        .from("incidents")
        .select(
          "id, status, primary_label, started_at, threat_score, hub_id, camera_id",
        )
        .order("started_at", { ascending: false })
        .limit(25);

      console.log("incidents data", incRes.data);
      console.log("incidents error", incRes.error);

      // hubs
      const hubRes = await supabase.from("hubs").select("*").limit(25);
      console.log("hubs data", hubRes.data);
      console.log("hubs error", hubRes.error);
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Supabase Test</h1>
      <p>Open DevTools console.</p>
    </div>
  );
}
