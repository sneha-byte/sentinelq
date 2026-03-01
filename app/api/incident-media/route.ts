import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/incident-media?incidentId=<uuid>
 * Returns public URLs for all media associated with an incident.
 * Uses the service role key to bypass RLS on the incident_media table.
 */
export async function GET(req: NextRequest) {
  const incidentId = req.nextUrl.searchParams.get("incidentId");
  if (!incidentId) {
    return NextResponse.json({ error: "incidentId is required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const { data, error } = await admin
      .from("incident_media")
      .select("media_type, storage_url")
      .eq("incident_id", incidentId)
      .order("created_at");

    if (error) {
      console.error("[/api/incident-media] db error:", error.message);
      return NextResponse.json({ clips: [], snapshots: [], thumbnails: [] });
    }

    const rows = data ?? [];

    const resolveUrl = (storageUrl: string): string => {
      if (!storageUrl) return "";
      if (storageUrl.startsWith("http")) return storageUrl;
      const { data: urlData } = admin.storage
        .from("incidents")
        .getPublicUrl(storageUrl);
      return urlData?.publicUrl ?? storageUrl;
    };

    const clips = rows
      .filter((r) => r.media_type === "clip")
      .map((r) => resolveUrl(r.storage_url))
      .filter(Boolean);

    const snapshots = rows
      .filter((r) => r.media_type === "snapshot")
      .map((r) => resolveUrl(r.storage_url))
      .filter(Boolean);

    const thumbnails = rows
      .filter((r) => r.media_type === "thumbnail")
      .map((r) => resolveUrl(r.storage_url))
      .filter(Boolean);

    return NextResponse.json({ clips, snapshots, thumbnails });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/incident-media] unexpected error:", msg);
    return NextResponse.json({ clips: [], snapshots: [], thumbnails: [], error: msg });
  }
}

