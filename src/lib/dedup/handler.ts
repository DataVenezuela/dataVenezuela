import type { z } from "zod";
import { authenticatePartner } from "@/lib/partners";
import { jsonError, readJson, validationError } from "@/lib/api";
import { ReferenceNotFoundError, type CreateResult } from "@/lib/dedup/service";
import { logIngest, newRequestId } from "@/lib/observability";

/**
 * Construye el handler POST de un endpoint de ingesta dedup. Comparte el flujo
 * con `POST /api/aportes`: auth por x-api-key → JSON → validación Zod → servicio.
 *
 * Códigos: 201 creado · 400 JSON inválido · 401 sin/llave inválida ·
 * 404 FK inexistente · 422 contrato inválido · 500 error interno.
 */
export function createIngestHandler<S extends z.ZodType>(
  schema: S,
  serviceFn: (input: z.infer<S>) => Promise<CreateResult>,
  route: string,
) {
  return async function POST(request: Request) {
    const requestId = newRequestId();
    const startedAt = Date.now();
    let scraperId: string | null = null;
    let rejected = false;

    const finish = (response: Response) => {
      try {
        response.headers.set("x-request-id", requestId);
      } catch {
        // headers inmutables en algún runtime: el request_id queda sólo en el log.
      }
      logIngest({
        request_id: requestId,
        route,
        scraper_id: scraperId,
        status: response.status,
        latency_ms: Date.now() - startedAt,
        rejected,
      });
      return response;
    };

    const partner = await authenticatePartner(request);
    if (!partner) return finish(jsonError("API key inválida o ausente", 401));
    scraperId = partner.scraperId;

    const body = await readJson(request);
    if (body === null) return finish(jsonError("JSON inválido", 400));

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      rejected = true;
      return finish(validationError(parsed.error));
    }

    try {
      const { id } = await serviceFn(parsed.data);
      return finish(Response.json({ id, status: "created" }, { status: 201 }));
    } catch (e) {
      if (e instanceof ReferenceNotFoundError) {
        return finish(jsonError(e.message, 404, { field: e.field }));
      }
      return finish(
        jsonError(e instanceof Error ? e.message : "Error interno", 500),
      );
    }
  };
}
