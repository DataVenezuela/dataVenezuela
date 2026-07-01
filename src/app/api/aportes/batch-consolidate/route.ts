import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, readJson } from "@/lib/api";
import { authenticatePartner } from "@/lib/partners";
import z from "zod";

const batchConsolidateSchema = z.object({
  aporte_ids: z.array(z.string().uuid()).max(500),
});

/**
 * POST /api/aportes/batch-consolidate
 * Marca un lote de aportes como consolidados (setea consolidated_at = now()).
 * Idempotente: si el aporte ya estaba consolidado, se cuenta en already_consolidated.
 *
 * Requiere autenticación por x-api-key (consolidation job o admin).
 *
 * Request body:
 * {
 *   "aporte_ids": ["uuid1", "uuid2", ...]
 * }
 *
 * Response 200:
 * {
 *   "consolidated": 3,
 *   "not_found": 0,
 *   "already_consolidated": 0
 * }
 */
export async function POST(request: Request) {
  // --- auth ---
  const partner = await authenticatePartner(request);
  if (!partner) return jsonError("API key inválida o ausente", 401);

  const body = await readJson(request);
  if (body === null) return jsonError("JSON inválido", 400);

  const parsed = batchConsolidateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Payload inválido: aporte_ids debe ser array de UUIDs", 422);
  }

  const { aporte_ids } = parsed.data;

  if (aporte_ids.length === 0) {
    return Response.json({
      consolidated: 0,
      not_found: 0,
      already_consolidated: 0,
    });
  }

  const supabase = createAdminClient();

  // Obtener estado actual de los aportes
  const { data: existing, error: fetchError } = await supabase
    .from("aportes")
    .select("id, consolidated_at")
    .in("id", aporte_ids);

  if (fetchError) {
    console.error("[POST /api/aportes/batch-consolidate] fetch error:", fetchError);
    return jsonError("Error interno al leer aportes", 500);
  }

  // Clasificar cuáles existen y cuáles ya están consolidados
  const existingIds = new Set((existing || []).map((a) => a.id));
  const alreadyConsolidatedCount = (existing || []).filter(
    (a) => a.consolidated_at !== null,
  ).length;
  const notFoundCount = aporte_ids.length - existingIds.size;

  // Solo marcar los que existen y aún no están consolidados
  const toConsolidate = Array.from(existingIds).filter((id) => {
    const record = (existing || []).find((a) => a.id === id);
    return record && record.consolidated_at === null;
  });

  if (toConsolidate.length === 0) {
    return Response.json({
      consolidated: 0,
      not_found: notFoundCount,
      already_consolidated: alreadyConsolidatedCount,
    });
  }

  // Marcar como consolidados y contar los actualizados
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("aportes")
    .update({ consolidated_at: now })
    .in("id", toConsolidate)
    .is("consolidated_at", null)
    .select("id");

  if (updateError) {
    console.error("[POST /api/aportes/batch-consolidate] update error:", updateError);
    return jsonError("Error interno al marcar aportes", 500);
  }

  // Contar realmente actualizados
  const consolidatedCount = updated ? updated.length : 0;

  return Response.json({
    consolidated: consolidatedCount,
    not_found: notFoundCount,
    already_consolidated: alreadyConsolidatedCount,
  });
}
