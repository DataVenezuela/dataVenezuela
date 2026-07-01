import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, readJson } from "@/lib/api";
import z from "zod";

const batchConsolidateSchema = z.object({
  aporte_ids: z.array(z.string().uuid()).max(500),
});

/**
 * POST /api/aportes/batch-consolidate
 * Marca un lote de aportes como consolidados (setea consolidated_at = now()).
 * Idempotente: si el aporte ya estaba consolidado, se cuenta en already_consolidated.
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

  if (fetchError) return jsonError(fetchError.message, 500);

  // Clasificar cuáles existen y cuáles ya están consolidados
  const existingIds = new Set((existing || []).map((a) => a.id));
  const alreadyConsolidatedCount = (existing || []).filter(
    (a) => a.consolidated_at !== null,
  ).length;
  const notFoundCount = aporte_ids.length - existingIds.size;
  const toConsolidate = Array.from(existingIds);

  if (toConsolidate.length === 0) {
    return Response.json({
      consolidated: 0,
      not_found: notFoundCount,
      already_consolidated: alreadyConsolidatedCount,
    });
  }

  // Marcar como consolidados
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("aportes")
    .update({ consolidated_at: now })
    .in("id", toConsolidate)
    .is("consolidated_at", null); // Solo actualizar los que aún no estaban consolidados

  if (updateError) return jsonError(updateError.message, 500);

  // El número real consolidado es los que ya no estaban
  const consolidated = toConsolidate.length - alreadyConsolidatedCount;

  return Response.json({
    consolidated,
    not_found: notFoundCount,
    already_consolidated: alreadyConsolidatedCount,
  });
}
