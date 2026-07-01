import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { authenticatePartner } from "@/lib/partners";

const VALID_ENTITY_TYPES = ["event", "acopio", "person"];
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

/**
 * GET /api/aportes/unconsolidated
 * Lee aportes pendientes de consolidación, paginado por cursor.
 *
 * Requiere autenticación por x-api-key (consolidation job o admin).
 *
 * Query params:
 * - entity_type: "event" | "acopio" | "person" (requerido)
 * - limit: int (default 100, max 500)
 * - cursor: opaque string en formato "created_at:id" codificado en base64
 *
 * Respuesta 200:
 * {
 *   "aportes": [...],
 *   "next_cursor": "..." | null
 * }
 */
export async function GET(request: Request) {
  // --- auth ---
  const partner = await authenticatePartner(request);
  if (!partner) return jsonError("API key inválida o ausente", 401);

  const url = new URL(request.url);
  const entityTypeRaw = url.searchParams.get("entity_type");
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor") || undefined;

  // Normalizar entity_type a slug minuscula
  const entityType = entityTypeRaw?.toLowerCase().trim();

  // Validar entity_type
  if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
    return jsonError(
      `invalid entity_type: '${entityTypeRaw}'. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}`,
      400,
    );
  }

  // Validar limit (1-500)
  let limit = DEFAULT_LIMIT;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return jsonError(
        `invalid limit: '${limitParam}'. Must be integer 1-${MAX_LIMIT}`,
        400,
      );
    }
    limit = parsed;
  }

  // Decodificar cursor "created_at:id"
  let cursorCreatedAt: string | undefined;
  let cursorId: string | undefined;
  if (cursorParam) {
    try {
      const decoded = Buffer.from(cursorParam, "base64").toString("utf-8");
      const [ts, id] = decoded.split(":");
      if (!ts || !id) throw new Error("formato invalido");
      cursorCreatedAt = ts;
      cursorId = id;
    } catch {
      return jsonError("invalid cursor format", 400);
    }
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("aportes")
    .select(
      "id, run_id, entity_type, external_id, dedup_hash, dedup_version, block_keys, content_hash, source_id, source_record_id, source_url, parser_version, normalizer_version, raw_json, created_at",
    )
    .is("consolidated_at", null)
    .eq("entity_type", entityType)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);

  // Keyset pagination: (created_at, id) > (cursorCreatedAt, cursorId)
  if (cursorCreatedAt && cursorId) {
    query = query.or(
      `and(created_at.gt.${cursorCreatedAt},id.gt.${cursorId}),and(created_at.eq.${cursorCreatedAt},id.gt.${cursorId})`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/aportes/unconsolidated]", error);
    return jsonError("Error interno al leer aportes", 500);
  }

  // Detectar si hay más registros
  const hasMore = data && data.length > limit;
  const aportes = data ? data.slice(0, limit) : [];

  // Construir cursor para la siguiente página
  let nextCursor: string | null = null;
  if (hasMore && aportes.length > 0) {
    const last = aportes[aportes.length - 1];
    nextCursor = Buffer.from(`${last.created_at}:${last.id}`).toString("base64");
  }

  return Response.json({
    aportes,
    next_cursor: nextCursor,
  });
}
