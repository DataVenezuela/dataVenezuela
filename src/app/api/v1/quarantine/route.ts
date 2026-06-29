import { quarantineInputSchema } from "@/lib/validation";
import {
  createQuarantineRecord,
  SourceOwnershipError,
} from "@/lib/services/quarantine";
import { authenticatePartner } from "@/lib/partners";
import { jsonError, readJson, validationError } from "@/lib/api";

/**
 * POST /api/v1/quarantine
 * Ingesta autenticada con `x-api-key` (igual que /api/aportes). El scraper manda
 * un registro que NO pudo procesar (parser ausente, schema invalido, PII no
 * redactable, etc.) para preservarlo en la Quarantine DB — nunca se descarta
 * (VZLA_DEDUP #88). Valida que la fuente sea propia (403 si no). Idempotente por
 * (source_slug, payload_hash).
 *
 * No hay GET: la cuarentena es plano interno de revision (otro spec), no publico.
 */
export async function POST(request: Request) {
  const partner = await authenticatePartner(request);
  if (!partner) return jsonError("API key inválida o ausente", 401);

  const body = await readJson(request);
  if (body === null) return jsonError("JSON inválido", 400);

  const parsed = quarantineInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { quarantineId, duplicate } = await createQuarantineRecord(parsed.data, {
      scraperId: partner.scraperId,
    });
    return Response.json(
      {
        id: quarantineId,
        duplicate,
        status: duplicate ? "duplicate" : "quarantined",
      },
      { status: duplicate ? 200 : 201 },
    );
  } catch (e) {
    if (e instanceof SourceOwnershipError) return jsonError(e.message, 403);
    return jsonError(e instanceof Error ? e.message : "Error interno", 500);
  }
}
