import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * GET /api/clips
 * Returns public URLs for the N most-recent clip.mp4 files in the `incidents`
 * storage bucket that are ≥ MIN_CLIP_BYTES (filters out placeholder/empty files).
 *
 * We always use the folder-listing path so we can verify both existence and size.
 * The incident_media table path was removed because it returns rows for every
 * incident regardless of whether a real file was actually uploaded, causing the
 * video player to cycle rapidly through hundreds of broken URLs.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Only return clips with substantial content (rules out placeholder files).
  const MIN_CLIP_BYTES = 500_000; // 500 KB — real 30-second clips are 1–5 MB

  // How many of the most-recent event folders to scan.
  // Keeping this small means we only surface recently-uploaded (H.264) clips
  // while avoiding the long tail of legacy mpeg4 files.
  const MAX_FOLDERS = 30;

  try {
    // ── List top-level folders (each is a Unix-ms timestamp) ──────────────────
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
        (f) =>
          f.name &&
          f.name !== ".emptyFolderPlaceholder" &&
          !f.name.endsWith(".mp4") &&
          !f.name.endsWith(".jpg") &&
          !f.name.endsWith(".png") &&
          !f.name.endsWith(".json")
      )
      .sort((a, b) => {
        const na = parseInt(a.name, 10) || 0;
        const nb = parseInt(b.name, 10) || 0;
        return nb - na; // newest first
      })
      .slice(0, MAX_FOLDERS); // only scan the most recent N folders

    if (folders.length === 0) {
      console.log("[/api/clips] no folders found in incidents bucket");
      return NextResponse.json({ urls: [] });
    }

    // ── For each folder, verify clip.mp4 exists and is large enough ──────────
    const BATCH = 10;
    const validUrls: { name: string; url: string }[] = [];

    for (let i = 0; i < folders.length; i += BATCH) {
      const batch = folders.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (folder) => {
          const { data: files } = await admin.storage
            .from("incidents")
            .list(folder.name, { limit: 20 });

          const clipFile = (files ?? []).find((f) => f.name === "clip.mp4");
          const sizeBytes: number =
            (clipFile?.metadata as { size?: number } | undefined)?.size ?? 0;

          if (!clipFile || sizeBytes < MIN_CLIP_BYTES) return null;

          const { data } = admin.storage
            .from("incidents")
            .getPublicUrl(`${folder.name}/clip.mp4`);

          return { name: folder.name, url: data.publicUrl };
        })
      );

      for (const r of results) {
        if (r !== null) validUrls.push(r);
      }
    }

    // Already sorted newest-first from the folders sort above
    const urls = validUrls.map((v) => v.url);
    console.log(
      `[/api/clips] returning ${urls.length} clip URLs from ${folders.length} most-recent folders (≥${MIN_CLIP_BYTES / 1000}KB)`
    );
    return NextResponse.json({ urls });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/clips] unexpected error:", msg);
    return NextResponse.json({ urls: [], error: msg }, { status: 500 });
  }
}
