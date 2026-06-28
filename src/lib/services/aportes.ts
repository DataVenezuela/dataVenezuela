import { createAdminClient } from "@/lib/supabase/admin";
import type { AporteInput } from "@/lib/validation";

export type CreateAporteResult = {
  aporteId: string;
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
 * Inserta un aporte (datos en bruto) atribuido al scraper autenticado.
 * - Valida que `sourceId` pertenezca al scraper (sources.owner_id = scraperId).
 * - Deduplica por (scraper_id, external_id): si ya existe, devuelve el existente
 *   con duplicate=true (idempotencia para la ingesta repetida del scraper).
 */
export async function createAporte(
  input: AporteInput,
  { scraperId }: { scraperId: string },
): Promise<CreateAporteResult> {
  const supabase = createAdminClient();

  // 1. Resolver la fuente por id o por slug, validando que pertenezca al scraper.
  let sourceQuery = supabase
    .from("sources")
    .select("id")
    .eq("owner_id", scraperId);
  sourceQuery = input.sourceId
    ? sourceQuery.eq("id", input.sourceId)
    : sourceQuery.eq("slug", input.sourceSlug as string);
  const { data: source } = await sourceQuery.maybeSingle();
  if (!source) throw new SourceOwnershipError();
  const sourceId = source.id;

  // 2. Dedup explícito por (scraper_id, external_id) cuando hay external_id.
  if (input.externalId) {
    const { data: existing } = await supabase
      .from("aportes")
      .select("id")
      .eq("scraper_id", scraperId)
      .eq("external_id", input.externalId)
      .maybeSingle();
    if (existing) return { aporteId: existing.id, duplicate: true };
  }

  // 3. Insertar. El índice único es el guardia real ante carreras concurrentes.
  const { data, error } = await supabase
    .from("aportes")
    .insert({
      external_id: input.externalId ?? null,
      raw_json: (input.rawJson ?? null) as never,
      raw_text: input.rawText ?? null,
      source_id: sourceId,
      scraper_id: scraperId,
      // Campos de staging para dedup cross-source (1:1 con el body camelCase).
      run_id: input.runId ?? null,
      entity_type: input.entityType ?? null,
      dedup_hash: input.dedupHash ?? null,
      dedup_version: input.dedupVersion ?? null,
      block_keys: input.blockKeys ?? null,
      content_hash: input.contentHash ?? null,
      source_record_id: input.sourceRecordId ?? null,
      source_url: input.sourceUrl ?? null,
      parser_version: input.parserVersion ?? null,
      normalizer_version: input.normalizerVersion ?? null,
      raw_artifact_id: input.rawArtifactId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation: otro request insertó el mismo (scraper, external_id).
    if (error.code === "23505" && input.externalId) {
      const { data: existing } = await supabase
        .from("aportes")
        .select("id")
        .eq("scraper_id", scraperId)
        .eq("external_id", input.externalId)
        .maybeSingle();
      if (existing) return { aporteId: existing.id, duplicate: true };
    }
    throw new Error(`createAporte failed: ${error.message}`);
  }

  return { aporteId: data.id, duplicate: false };
}
