import { aporteInputSchema } from "@/lib/validation";
import { createAporte, SourceOwnershipError } from "@/lib/services/aportes";
import { authenticatePartner } from "@/lib/partners";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, readJson, validationError } from "@/lib/api";

// Columnas seguras expuestas en la lectura pública (sin scraper_id interno).
const PUBLIC_COLUMNS = "id, external_id, raw_json, raw_text, source_id, created_at, updated_at";
const MAX_LIMIT = 200;

/**
 * POST /api/aportes
 * Ingesta autenticada con `x-api-key`. La key identifica al scraper; el cuerpo
 * trae `source_id` (validado como propio) y `raw_json`/`raw_text`. Idempotente
 * por (scraper_id, external_id).
 */
export async function POST(request: Request) {
  const partner = await authenticatePartner(request);
  if (!partner) return jsonError("API key inválida o ausente", 401);

  const body = await readJson(request);
  if (body === null) return jsonError("JSON inválido", 400);

  const parsed = aporteInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { aporteId, duplicate } = await createAporte(parsed.data, {
      scraperId: partner.scraperId,
    });
    return Response.json(
      {
        id: aporteId,
        externalId: parsed.data.externalId ?? null,
        duplicate,
        status: duplicate ? "duplicate" : "received",
      },
      { status: duplicate ? 200 : 201 },
    );
  } catch (e) {
    if (e instanceof SourceOwnershipError) return jsonError(e.message, 403);
    return jsonError(e instanceof Error ? e.message : "Error interno", 500);
  }
}

/**
 * GET /api/aportes
 * Lectura pública (sin key). Filtros opcionales: `source_id`, `external_id`.
 * Paginación: `limit` (máx 200), `offset`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sourceId = url.searchParams.get("source_id");
  const externalId = url.searchParams.get("external_id");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 50, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const supabase = createAdminClient();
  let query = supabase
    .from("aportes")
    .select(PUBLIC_COLUMNS)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (sourceId) query = query.eq("source_id", sourceId);
  if (externalId) query = query.eq("external_id", externalId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return Response.json({ aportes: data, limit, offset });
}
