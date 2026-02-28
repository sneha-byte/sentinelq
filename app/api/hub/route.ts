import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  const body = await req.json();

  const { data, error } = await supabaseAdmin
    .from('incidents')
    .insert({
        camera_id: body.camera_id,
        threat_score: body.threat_score,
        quality_score: body.quality_score,
        route_mode: body.route_mode,
        summary_local: body.summary_local
    })
    .select()
    .single();

  if (error) {
      return new Response(JSON.stringify({ error }), { status: 400 });
  }

  return Response.json({ incident: data });
} 