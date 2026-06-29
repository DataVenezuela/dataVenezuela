import { authenticatePartner } from "@/lib/partners";
import { jsonError, readJson, validationError } from "@/lib/api";
import { SourceOwnershipError } from "@/lib/services/aportes";
import { createQuarantineRecord } from "@/lib/services/quarantine";
import { quarantineInputSchema } from "@/lib/validation";

/** POST /api/v1/quarantine — ingesta autenticada de registros en cuarentena. */
export async function POST(request: Request) {
  const partner = await authenticatePartner(request);
  if (!partner) return jsonError("API key inválida o ausente", 401);

  const body = await readJson(request);
  if (body === null) return jsonError("JSON inválido", 400);

  const parsed = quarantineInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const id = await createQuarantineRecord(parsed.data, {
      scraperId: partner.scraperId,
    });
    return Response.json({ id, status: "quarantined" }, { status: 201 });
  } catch (e) {
    if (e instanceof SourceOwnershipError) return jsonError(e.message, 403);
    return jsonError(e instanceof Error ? e.message : "Error interno", 500);
  }
}
