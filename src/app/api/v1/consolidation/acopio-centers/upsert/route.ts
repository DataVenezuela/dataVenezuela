import { jsonError, readJson, validationError } from "@/lib/api";
import { authenticatePartner } from "@/lib/partners";
import { upsertAcopioCenterByDedupHash, ReferenceNotFoundError } from "@/lib/dedup/service";
import { acopioCenterInputSchema } from "@/lib/dedup/validation";
import { newRequestId, logIngest } from "@/lib/observability";
import z from "zod";

// Schema para upsert: acopio center fields + dedup_hash + trust_tier
const acopioCenterUpsertSchema = acopioCenterInputSchema.extend({
  dedup_hash: z.string().regex(/^[0-9a-f]{64}$/),
  trust_tier: z.number().int().refine((n): n is 1 | 2 | 3 => [1, 2, 3].includes(n)),
});

/**
 * POST /api/v1/consolidation/acopio-centers/upsert
 * Upsert atómico en tabla `acopio_centers` por dedup_hash.
 * Si el centro existe con mejor trust_tier, retorna 409 (conflict).
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const startedAt = Date.now();
  let scraperId: string | null = null;

  const finish = (response: Response) => {
    try {
      response.headers.set("x-request-id", requestId);
    } catch {
      // headers inmutables en algún runtime
    }
    logIngest({
      request_id: requestId,
      route: "/api/v1/consolidation/acopio-centers/upsert",
      scraper_id: scraperId,
      status: response.status,
      latency_ms: Date.now() - startedAt,
      rejected: false,
    });
    return response;
  };

  const partner = await authenticatePartner(request);
  if (!partner) return finish(jsonError("API key inválida o ausente", 401));
  scraperId = partner.scraperId;

  const body = await readJson(request);
  if (body === null) return finish(jsonError("JSON inválido", 400));

  const parsed = acopioCenterUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return finish(validationError(parsed.error));
  }

  try {
    const result = await upsertAcopioCenterByDedupHash(parsed.data);
    const statusCode =
      result.status === "created"
        ? 201
        : result.status === "updated"
          ? 200
          : 409;

    return finish(
      Response.json(
        {
          acopio_id: result.id,
          status: result.status,
          previous_trust_tier: result.previous_trust_tier,
        },
        { status: statusCode },
      ),
    );
  } catch (e) {
    if (e instanceof ReferenceNotFoundError) {
      return finish(jsonError(e.message, 404, { field: e.field }));
    }
    return finish(
      jsonError(e instanceof Error ? e.message : "Error interno", 500),
    );
  }
}
