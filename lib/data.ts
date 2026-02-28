import { supabase } from "./supabaseClient";

export async function fetchIncidents() {
  const { data, error } = await supabase
    .from("incidents")
    .select("id, status, primary_label, started_at, threat_score, hub_id, camera_id")
    .order("started_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchHubs() {
  const { data, error } = await supabase
    .from("hubs")
    .select("id, device_name, status, user_id")
    .order("device_name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}