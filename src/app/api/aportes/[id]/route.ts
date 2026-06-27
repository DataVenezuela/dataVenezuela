import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";

const PUBLIC_COLUMNS = "id, external_id, raw_json, raw_text, source_id, created_at, updated_at";

/** GET /api/aportes/:id — un aporte por id interno (lectura pública). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("aportes")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Aporte no encontrado", 404);
  return Response.json({ aporte: data });
}
