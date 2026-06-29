import type { Env } from "../env";

// Forma de respuesta definida por HealthResponse en docs/openapi-public-serving.json
// (additionalProperties: false). No agregar campos fuera de este contrato.
export interface HealthResponse {
  ok: boolean;
  snapshot_version?: string;
}

// Funcion pura: testeable sin el runtime de Workers.
export async function handleHealthz(env: Env): Promise<HealthResponse> {
  const body: HealthResponse = { ok: true };

  if (env.DB) {
    try {
      // snapshot_metadata la escribe el export de PR #10 (key 'generated_at').
      const row = await env.DB.prepare(
        "select value from snapshot_metadata where key = ?1",
      )
        .bind("generated_at")
        .first<{ value: string }>();
      if (row?.value) {
        body.snapshot_version = row.value;
      }
    } catch (error) {
      // Sin artefacto cargado o sin tabla: el healthz sigue respondiendo ok.
      console.error("Error occurred while fetching snapshot version", error);
    }
  }

  return body;
}
