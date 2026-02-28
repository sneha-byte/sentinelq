import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false });

  return Response.json({ incidents: data });
}