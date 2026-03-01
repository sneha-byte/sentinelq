import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * GET /api/clips
 * Returns public URLs for the N most-recent clip.mp4 files in the `incidents`
 * storage bucket that are ≥ MIN_CLIP_BYTES (filters out placeholder/empty files).
 * Uses the service role key to bypass Supabase RLS.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const MIN_CLIP_BYTES = 500_000; // 500 KB — real clips are 1–5 MB
  const MAX_FOLDERS    = 30;      // only scan the most recent N folders

  try {
    // List top-level folders (each is a Unix-ms timestamp)
    const { data: topLevel, error: topErr } = await admin.storage
      .from("incidents")
      .list("", { limit: 1000 });

    if (topErr) {
      console.error("[/api/clips] top-level list error:", topErr);
      return NextResponse.json({ urls: [], error: topErr.message }, { status: 500 });
    }

    // Keep only folders (no extension), sorted newest-first
    const folders = (topLevel ?? [])
      .filter(
        f =>
          f.name &&
          f.name !== ".emptyFolderPlaceholder" &&
          !f.name.includes(".")
      )
      .sort((a, b) => {
        const na = parseInt(a.name, 10) || 0;
        const nb = parseInt(b.name, 10) || 0;
        return nb - na;
      })
      .slice(0, MAX_FOLDERS);

    if (folders.length === 0) {
      return NextResponse.json({ urls: [] });
    }

    // For each folder, verify clip.mp4 exists and is large enough
    const BATCH = 10;
    const validUrls: string[] = [];

    for (let i = 0; i < folders.length; i += BATCH) {
      const batch = folders.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async folder => {
          const { data: files } = await admin.storage
            .from("incidents")
            .list(folder.name, { limit: 20 });

          const clipFile = (files ?? []).find(f => f.name === "clip.mp4");
          const sizeBytes: number =
            (clipFile?.metadata as { size?: number } | undefined)?.size ?? 0;

          if (!clipFile || sizeBytes < MIN_CLIP_BYTES) return null;

          const { data } = admin.storage
            .from("incidents")
            .getPublicUrl(`${folder.name}/clip.mp4`);

          return data.publicUrl;
        })
      );

      for (const r of results) {
        if (r !== null) validUrls.push(r as string);
      }
    }

    console.log(
      `[/api/clips] returning ${validUrls.length} clip URLs (≥${MIN_CLIP_BYTES / 1000}KB)`
    );
    return NextResponse.json({ urls: validUrls });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/clips] unexpected error:", msg);
    return NextResponse.json({ urls: [], error: msg }, { status: 500 });
  }
}
