import { createAdminClient } from "@/lib/supabase/admin";
import type { QuarantineInput } from "@/lib/validation";

export type CreateQuarantineResult = {
  quarantineId: string;
  duplicate: boolean;
};

/** La fuente indicada no existe o no pertenece al scraper autenticado. */
export class SourceOwnershipError extends Error {
  constructor() {
    super("La fuente no existe o no pertenece a tu cuenta");
    this.name = "SourceOwnershipError";
  }
}

/**
 * Inserta un registro en cuarentena para una fuente propia del scraper.
 *
 * - Valida que `sourceSlug` pertenezca al scraper (sources.owner_id = scraperId);
 *   si no, lanza SourceOwnershipError (el route lo traduce a 403). Mismo patron
 *   que `createAporte`.
 * - Idempotente por (source_slug, payload_hash): si ese payload ya fue encolado
 *   para esa fuente, devuelve el existente con duplicate=true. El indice unico
 *   parcial es el guardia real ante carreras concurrentes.
 *
 * Solo persiste preview redactado + hash + metadata; nunca PII en claro (el
 * scraper ya redacta antes de enviar).
 */
export async function createQuarantineRecord(
  input: QuarantineInput,
  { scraperId }: { scraperId: string },
): Promise<CreateQuarantineResult> {
  const supabase = createAdminClient();

  // 1. Validar ownership: la fuente debe existir y ser del scraper autenticado.
  const { data: source } = await supabase
    .from("sources")
    .select("slug")
    .eq("owner_id", scraperId)
    .eq("slug", input.sourceSlug)
    .maybeSingle();
  if (!source) throw new SourceOwnershipError();

  // 2. Dedup explicito por (source_slug, payload_hash) cuando hay hash.
  if (input.payloadHash) {
    const { data: existing } = await supabase
      .from("quarantine_records")
      .select("quarantine_id")
      .eq("source_slug", input.sourceSlug)
      .eq("payload_hash", input.payloadHash)
      .maybeSingle();
    if (existing) {
      return { quarantineId: existing.quarantine_id, duplicate: true };
    }
  }

  // 3. Insertar. review_status arranca en 'pending' (default en la tabla).
  const { data, error } = await supabase
    .from("quarantine_records")
    .insert({
      run_id: input.runId ?? null,
      source_slug: input.sourceSlug,
      source_url: input.sourceUrl ?? null,
      reason_code: input.reasonCode,
      reason_detail: input.reasonDetail ?? null,
      risk_level: input.riskLevel,
      payload_preview_redacted: input.payloadPreviewRedacted ?? null,
      payload_hash: input.payloadHash ?? null,
      pii_findings_summary: (input.piiFindingsSummary ?? null) as never,
    })
    .select("quarantine_id")
    .single();

  if (error) {
    // 23505 = unique_violation: otro request encolo el mismo (source, hash).
    if (error.code === "23505" && input.payloadHash) {
      const { data: existing } = await supabase
        .from("quarantine_records")
        .select("quarantine_id")
        .eq("source_slug", input.sourceSlug)
        .eq("payload_hash", input.payloadHash)
        .maybeSingle();
      if (existing) {
        return { quarantineId: existing.quarantine_id, duplicate: true };
      }
    }
    throw new Error(`createQuarantineRecord failed: ${error.message}`);
  }

  return { quarantineId: data.quarantine_id, duplicate: false };
}
