import { createAdminClient } from "@/lib/supabase/admin";
import type { AporteInput } from "@/lib/validation";

export type CreateAportesBulkResult = {
  sent: number;
  duplicates: number;
  errors: string[];
};

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

/**
 * Inserta un batch de aportes (hasta 500).
 * - Resuelve fuentes en batch (2 queries en paralelo: una por IDs, otra por slugs).
 *   Si sourceId no resuelve, el slug actúa de fallback.
 * - Deduplica por externalId en batch antes de insertar (incluye dedup intra-batch).
 * - Usa ON CONFLICT DO NOTHING para manejar carreras sin retry secuencial.
 */
export async function createAportesBulk(
  inputs: AporteInput[],
  { scraperId }: { scraperId: string },
): Promise<CreateAportesBulkResult> {
  if (inputs.length === 0) return { sent: 0, duplicates: 0, errors: [] };

  const supabase = createAdminClient();
  const errors: string[] = [];

  // 1. Resolver todas las fuentes únicas del batch en 1-2 queries paralelas.
  //    Se recopilan slugs de todos los ítems (con o sin sourceId) para permitir
  //    fallback a slug cuando sourceId no resuelve.
  const uniqueSourceIds = [...new Set(inputs.flatMap((i) => (i.sourceId ? [i.sourceId] : [])))];
  const uniqueSourceSlugs = [...new Set(inputs.flatMap((i) => (i.sourceSlug ? [i.sourceSlug] : [])))];

  const sourceById = new Map<string, string>();
  const sourceBySlug = new Map<string, string>();

  const sourceQueryPromises: Promise<void>[] = [];

  if (uniqueSourceIds.length > 0) {
    sourceQueryPromises.push(
      supabase
        .from("sources")
        .select("id, slug")
        .eq("owner_id", scraperId)
        .in("id", uniqueSourceIds)
        .then(({ data, error }) => {
          if (error) throw new Error(`Source lookup failed: ${error.message}`);
          for (const src of data ?? []) {
            sourceById.set(src.id, src.id);
            if (src.slug) sourceBySlug.set(src.slug, src.id);
          }
        }),
    );
  }

  if (uniqueSourceSlugs.length > 0) {
    sourceQueryPromises.push(
      supabase
        .from("sources")
        .select("id, slug")
        .eq("owner_id", scraperId)
        .in("slug", uniqueSourceSlugs)
        .then(({ data, error }) => {
          if (error) throw new Error(`Source lookup failed: ${error.message}`);
          for (const src of data ?? []) {
            sourceById.set(src.id, src.id);
            if (src.slug) sourceBySlug.set(src.slug, src.id);
          }
        }),
    );
  }

  await Promise.all(sourceQueryPromises);

  // 2. Mapear cada ítem a su sourceId resuelto; los que fallen van a errors[].
  //    Si sourceId se provee pero no resuelve, el slug actúa de fallback.
  type ValidItem = { input: AporteInput; resolvedSourceId: string };
  const validItems: ValidItem[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const resolvedSourceId = input.sourceId
      ? (sourceById.get(input.sourceId) ?? (input.sourceSlug ? sourceBySlug.get(input.sourceSlug) : undefined))
      : input.sourceSlug
        ? sourceBySlug.get(input.sourceSlug)
        : undefined;
    if (!resolvedSourceId) {
      errors.push(`[${i}] La fuente no existe o no pertenece a tu cuenta`);
    } else {
      validItems.push({ input, resolvedSourceId });
    }
  }

  if (validItems.length === 0) return { sent: 0, duplicates: 0, errors };

  // 3. Dedup batch: encontrar qué externalIds ya existen en la DB.
  const extIds = validItems.flatMap((v) => (v.input.externalId ? [v.input.externalId] : []));
  const existingExtIds = new Set<string>();

  if (extIds.length > 0) {
    const { data: existing } = await supabase
      .from("aportes")
      .select("external_id")
      .eq("scraper_id", scraperId)
      .in("external_id", extIds);
    for (const row of existing ?? []) {
      if (row.external_id) existingExtIds.add(row.external_id);
    }
  }

  // 4. Separar duplicados de los ítems a insertar.
  //    seenExtIds deduplica ítems con el mismo externalId dentro del mismo request
  //    para evitar conflictos intra-batch que dispararían el retry costoso.
  let duplicates = 0;
  const toInsert: object[] = [];
  const seenExtIds = new Set<string>();

  for (const { input, resolvedSourceId } of validItems) {
    if (input.externalId && existingExtIds.has(input.externalId)) {
      duplicates++;
      continue;
    }
    if (input.externalId && seenExtIds.has(input.externalId)) {
      duplicates++;
      continue;
    }
    if (input.externalId) seenExtIds.add(input.externalId);
    toInsert.push({
      external_id: input.externalId ?? null,
      raw_json: (input.rawJson ?? null) as never,
      raw_text: input.rawText ?? null,
      source_id: resolvedSourceId,
      scraper_id: scraperId,
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
    });
  }

  if (toInsert.length === 0) return { sent: 0, duplicates, errors };

  // 5. INSERT batch con ON CONFLICT DO NOTHING para absorber carreras sin retry
  //    secuencial. Solo las filas efectivamente insertadas aparecen en `inserted`.
  const { data: inserted, error } = await supabase
    .from("aportes")
    .upsert(toInsert, { onConflict: "external_id", ignoreDuplicates: true })
    .select("id");

  if (!error) {
    const sent = inserted?.length ?? 0;
    duplicates += toInsert.length - sent;
    return { sent, duplicates, errors };
  }

  // Error no relacionado con conflictos: reintentar ítem a ítem para rescatar
  // los que sí se pueden insertar y reportar los que fallan individualmente.
  let sent = 0;
  for (const row of toInsert) {
    const { error: rowErr } = await supabase.from("aportes").insert(row);
    if (!rowErr) {
      sent++;
    } else if (rowErr.code === "23505") {
      duplicates++;
    } else {
      const extId = (row as { external_id?: string }).external_id;
      errors.push(
        `Error al insertar external_id=${extId ?? "(sin id)"}: ${rowErr.message}`,
      );
    }
  }
  return { sent, duplicates, errors };
}
