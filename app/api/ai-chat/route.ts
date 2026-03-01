import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PERSONA = `You are SentinelQ AI, an intelligent security assistant built into the SentinelQ edge-to-cloud surveillance platform.
You have access to real-time incident data, camera statuses, threat scores, and analysis results from the system.
Be concise, professional, and helpful. When summarising, use bullet points. When answering questions, be direct.
Always refer to cameras and incidents by their actual names/IDs from the data provided.
If asked something outside of security/surveillance context, politely redirect to what you can help with.`;

function buildContext(incidents: any[], cameras: any[]): string {
  const now = Date.now();
  const onlineCams  = cameras.filter(c => c.status === "online").length;
  const offlineCams = cameras.filter(c => c.status !== "online").length;

  const total     = incidents.length;
  const active    = incidents.filter(i => !i.ended_at).length;
  const resolved  = incidents.filter(i =>  i.ended_at).length;
  const highThreat = incidents.filter(i => (i.threat_score ?? 0) >= 70).length;
  const edgeCount  = incidents.filter(i => i.route_mode === "LOCAL").length;
  const cloudCount = incidents.filter(i => i.route_mode === "CLOUD").length;
  const hybridCount = incidents.filter(i => i.route_mode === "LOCAL_VERIFY_CLOUD").length;

  const avgThreat  = total > 0
    ? Math.round(incidents.reduce((s, i) => s + (i.threat_score ?? 0), 0) / total)
    : 0;
  const avgQuality = total > 0
    ? Math.round(incidents.reduce((s, i) => s + (i.quality_score ?? 0), 0) / total)
    : 0;
  const avgConf    = total > 0
    ? (incidents.reduce((s, i) => s + (i.confidence_score ?? 0), 0) / total).toFixed(2)
    : "0.00";

  // Top 5 highest-threat incidents
  const top5 = [...incidents]
    .sort((a, b) => (b.threat_score ?? 0) - (a.threat_score ?? 0))
    .slice(0, 5);

  const top5Lines = top5.map(i => {
    const camName = i.cameras?.name ?? i.camera_id ?? "Unknown Camera";
    const status  = i.ended_at ? "resolved" : "ACTIVE";
    const age     = Math.round((now - new Date(i.started_at).getTime()) / 60000);
    return `  - [${status}] ${i.primary_label ?? "motion_detected"} on ${camName} | threat=${i.threat_score ?? "?"}/100 | conf=${((i.confidence_score ?? 0) * 100).toFixed(0)}% | ${age}m ago | route=${i.route_mode ?? "?"} | cloud summary: ${i.summary_cloud ?? "pending"}`;
  }).join("\n");

  const camLines = cameras.map(c =>
    `  - ${c.name} (${c.location_label ?? "unknown location"}): ${c.status}`
  ).join("\n");

  return `=== SYSTEM CONTEXT (last 24 hours) ===
Generated: ${new Date().toLocaleString()}

CAMERAS (${cameras.length} total):
${camLines || "  No camera data"}
  Online: ${onlineCams} | Offline: ${offlineCams}

INCIDENTS SUMMARY:
  Total:         ${total}
  Active:        ${active}
  Resolved:      ${resolved}
  High-threat (≥70): ${highThreat}
  Avg threat score:  ${avgThreat}/100
  Avg quality score: ${avgQuality}/100
  Avg confidence:    ${avgConf}
  Route split:   ${edgeCount} edge | ${cloudCount} cloud | ${hybridCount} hybrid

TOP ${top5.length} HIGH-THREAT INCIDENTS:
${top5Lines || "  None"}
=== END CONTEXT ===`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { messages } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  if (!messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // ── Fetch last 24h data from Supabase ──────────────────────────────────────
  let contextBlock = "";
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: incidents }, { data: cameras }] = await Promise.all([
      supabase
        .from("incidents")
        .select(`id, camera_id, primary_label, started_at, ended_at,
                 threat_score, quality_score, confidence_score,
                 route_mode, summary_local, summary_cloud, status,
                 cameras ( name )`)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(50),
      supabase
        .from("cameras")
        .select("id, name, status, location_label"),
    ]);

    contextBlock = buildContext(incidents ?? [], cameras ?? []);
  } catch (err) {
    console.error("[ai-chat] context fetch failed:", err);
    contextBlock = "=== SYSTEM CONTEXT: unavailable (DB error) ===";
  }

  // ── Build Gemini conversation ──────────────────────────────────────────────
  // Gemini requires alternating user/model turns.
  // Inject system persona + context into the first user message.
  const geminiContents = messages.map((m, idx) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{
      text: idx === 0
        ? `${SYSTEM_PERSONA}\n\n${contextBlock}\n\n${m.content}`
        : m.content,
    }],
  }));

  // ── Call Gemini ────────────────────────────────────────────────────────────
  const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: geminiContents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text();
    console.error("[ai-chat] Gemini error:", errBody);
    return NextResponse.json({ error: "Gemini API error", detail: errBody }, { status: 502 });
  }

  const geminiData = await geminiRes.json();
  const reply =
    geminiData.candidates?.[0]?.content?.parts?.[0]?.text ??
    "Sorry, I couldn't generate a response right now.";

  return NextResponse.json({ message: reply });
}

