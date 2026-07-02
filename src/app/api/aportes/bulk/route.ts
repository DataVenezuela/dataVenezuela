import { aporteInputSchema, aportesBulkBodySchema } from "@/lib/validation";
import { createAportesBulk, SourceOwnershipError } from "@/lib/services/aportes";
import { authenticatePartner } from "@/lib/partners";
import { jsonError, readJson, validationError } from "@/lib/api";
import type { AporteInput } from "@/lib/validation";

/**
 * POST /api/aportes/bulk
 * Ingesta batch autenticada con `x-api-key`. Hasta 500 aportes por request.
 * Idempotente por externalId (igual que el endpoint individual).
 * Responde 200 con { sent, duplicates, errors } cuando al menos un ítem fue procesado.
 * 422 si todos los ítems fallaron o si la estructura externa del body es inválida.
 */
export async function POST(request: Request) {
  const partner = await authenticatePartner(request);
  if (!partner) return jsonError("API key inválida o ausente", 401);

  const body = await readJson(request);
  if (body === null) return jsonError("JSON inválido", 400);

  const bodyParsed = aportesBulkBodySchema.safeParse(body);
  if (!bodyParsed.success) return validationError(bodyParsed.error);

  // Validación por ítem: los inválidos van a errors[], no abortan el batch.
  const parseErrors: string[] = [];
  const validInputs: AporteInput[] = [];
  for (let i = 0; i < bodyParsed.data.aportes.length; i++) {
    const result = aporteInputSchema.safeParse(bodyParsed.data.aportes[i]);
    if (result.success) {
      validInputs.push(result.data);
    } else {
      const issues = result.error.issues
        .map((iss) => `${iss.path.join(".") || "body"}: ${iss.message}`)
        .join("; ");
      parseErrors.push(`[${i}] ${issues}`);
    }
  }

  try {
    const result = await createAportesBulk(validInputs, {
      scraperId: partner.scraperId,
    });
    const allErrors = [...parseErrors, ...result.errors];
    const status = result.sent === 0 && allErrors.length > 0 ? 422 : 200;
    return Response.json({ ...result, errors: allErrors }, { status });
  } catch (e) {
    if (e instanceof SourceOwnershipError) return jsonError(e.message, 403);
    return jsonError(e instanceof Error ? e.message : "Error interno", 500);
  }
}
