import { authenticatePartner } from "@/lib/partners";
import { jsonError, readJson, validationError } from "@/lib/api";
import { SourceOwnershipError } from "@/lib/services/aportes";
import { getWatermark, setWatermark } from "@/lib/services/source-watermarks";
import { watermarkInputSchema } from "@/lib/validation";

/**
 * GET /api/source-watermarks/{slug}
 * Lee el watermark de una fuente propia (auth `x-api-key`). Si la fuente existe
 * pero no tiene fila, devuelve el default `1970-01-01T00:00:00Z`. Fuente ajena → 403.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const partner = await authenticatePartner(request);
  if (!partner) return jsonError("API key inválida o ausente", 401);

  const { slug } = await params;
  try {
    const watermarkAt = await getWatermark(slug, {
      scraperId: partner.scraperId,
    });
    return Response.json({ sourceSlug: slug, watermarkAt });
  } catch (e) {
    if (e instanceof SourceOwnershipError) return jsonError(e.message, 403);
    return jsonError(e instanceof Error ? e.message : "Error interno", 500);
  }
}

/**
 * PUT /api/source-watermarks/{slug}
 * Upsert del watermark de una fuente propia. Body `{ "watermarkAt": "<ISO>" }`.
 * Body inválido → 422; fuente ajena → 403; éxito → 200 con el valor guardado.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const partner = await authenticatePartner(request);
  if (!partner) return jsonError("API key inválida o ausente", 401);

  const body = await readJson(request);
  if (body === null) return jsonError("JSON inválido", 400);

  const parsed = watermarkInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { slug } = await params;
  try {
    const watermarkAt = await setWatermark(slug, parsed.data.watermarkAt, {
      scraperId: partner.scraperId,
    });
    return Response.json({ sourceSlug: slug, watermarkAt });
  } catch (e) {
    if (e instanceof SourceOwnershipError) return jsonError(e.message, 403);
    return jsonError(e instanceof Error ? e.message : "Error interno", 500);
  }
}
