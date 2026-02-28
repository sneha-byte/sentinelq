import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(req: Request, { params }: any) {
  const { id } = params;

  const imageBuffer = await req.arrayBuffer();
  const fileName = `${id}/snapshot.jpg`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('incident-media')
    .upload(fileName, SourceBuffer.from(imageBuffer), {
      contentType: 'image/jpeg',
      upsert: true
    });
  
  if (uploadError) {
      return new Response(JSON.stringify(uploadError), { status: 400});
  }

  const publicUrl = supabaseAdmin.storage
    .from('incident-media')
    .getPublicUrl(fileName).data.publicUrl;
  
  // Store URL into DB
  await supabaseAdmin
    .from('incidents')
    .update({ snapshot_url: publicUrl })
    .eq('id', id);
  
    return Response.json({ snapshot_url: publicUrl });
}