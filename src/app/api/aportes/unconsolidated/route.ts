import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";

const VALID_ENTITY_TYPES = ["Event", "AcopioCenter", "Person"];
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

/**
 * GET /api/aportes/unconsolidated
 * Lee aportes pendientes de consolidación, paginado por cursor.
 *
 * Query params:
 * - entity_type: "Event" | "AcopioCenter" | "Person" (requerido)
 * - limit: int (default 100, max 500)
 * - cursor: opaque string (pagination cursor, omit para primera página)
 *
 * Respuesta 200:
 * {
 *   "aportes": [...],
 *   "next_cursor": "..." | null
 * }
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entity_type");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const cursor = url.searchParams.get("cursor") || undefined;

  // Validar entity_type
  if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
    return jsonError(
      `invalid entity_type: '${entityType}'. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}`,
      400,
    );
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("aportes")
    .select(
      "id, run_id, entity_type, external_id, dedup_hash, dedup_version, block_keys, content_hash, source_slug, source_record_id, source_url, parser_version, normalizer_version, raw_json, created_at",
    )
    .is("consolidated_at", null) // Solo aportes sin consolidar
    .eq("entity_type", entityType)
    .order("created_at", { ascending: true }) // FIFO
    .limit(limit + 1); // +1 para detectar si hay más

  // Cursor-based pagination: cursor es el último id visto
  if (cursor) {
    query = query.gt("id", cursor);
  }

  const { data, error } = await query;

  if (error) return jsonError(error.message, 500);

  // Detectar si hay más registros
  const hasMore = data && data.length > limit;
  const aportes = data ? data.slice(0, limit) : [];
  const nextCursor =
    hasMore && aportes.length > 0
      ? aportes[aportes.length - 1].id
      : null;

  return Response.json({
    aportes,
    next_cursor: nextCursor,
  });
}
