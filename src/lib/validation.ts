import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums (deben coincidir con los tipos del esquema SQL)
// ---------------------------------------------------------------------------
export const userRoleEnum = z.enum(["public_submitter", "scraper", "admin"]);

// ---------------------------------------------------------------------------
// Helpers: trata "" como ausente (los formularios envían strings vacíos)
// ---------------------------------------------------------------------------
export const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const optionalText = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());
const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());
// hash en hex (SHA-256, ≤64 chars). El exporter lo precalcula; aquí solo formato.
const optionalHash = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^[0-9a-f]{1,64}$/, "debe ser hex (≤64 caracteres)")
    .optional(),
);

// ---------------------------------------------------------------------------
// sources — alta/edición de fuentes (acción de admin)
// ---------------------------------------------------------------------------
export const sourceInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  slug: z.preprocess(emptyToUndefined, z.string().optional()),
  website: optionalUrl,
});

export type SourceInput = z.infer<typeof sourceInputSchema>;

// ---------------------------------------------------------------------------
// aportes — ingesta por API (autenticada con x-api-key)
// La tabla es flexible: jsonb + texto en bruto. Se exige al menos uno de los dos.
// ---------------------------------------------------------------------------
export const aporteInputSchema = z
  .object({
    externalId: optionalText,
    // La fuente se identifica por su id (uuid) O por su slug; el sistema resuelve el id.
    sourceId: z.preprocess(
      emptyToUndefined,
      z.uuid("source_id debe ser un UUID válido").optional(),
    ),
    sourceSlug: optionalText,
    rawJson: z.unknown().optional(), // cualquier JSON (objeto, arreglo, escalar)
    rawText: optionalText,
    // Campos de staging para dedup cross-source (los manda el staging_exporter de
    // VZLA_DEDUP). Todos opcionales: la ingesta sin ellos sigue funcionando igual.
    runId: optionalUuid,
    entityType: z.preprocess(
      emptyToUndefined,
      z.enum(["event", "acopio", "person"]).optional(),
    ),
    dedupHash: optionalHash,
    dedupVersion: optionalText,
    blockKeys: z.preprocess(emptyToUndefined, z.array(z.string()).optional()),
    contentHash: optionalHash,
    sourceRecordId: optionalText,
    sourceUrl: optionalUrl,
    parserVersion: optionalText,
    normalizerVersion: optionalText,
    rawArtifactId: optionalUuid,
  })
  .refine((d) => d.sourceId !== undefined || d.sourceSlug !== undefined, {
    message: "Se requiere source_id o source_slug",
    path: ["sourceId"],
  })
  .refine(
    (d) =>
      (d.rawJson !== undefined && d.rawJson !== null) ||
      (typeof d.rawText === "string" && d.rawText.length > 0),
    { message: "Se requiere raw_json o raw_text", path: ["rawJson"] },
  );

export type AporteInput = z.infer<typeof aporteInputSchema>;

// ---------------------------------------------------------------------------
// quarantine — registros no procesables (autenticada con x-api-key). SPEC-0015.
// El scraper preserva aquí lo que no pudo procesar; el preview ya viene redactado.
// Los enums deben coincidir con los CHECK de `quarantine_records` (0011).
// ---------------------------------------------------------------------------
export const quarantineReasonCodeEnum = z.enum([
  "pii_untreatable",
  "invalid_schema",
  "parser_unavailable",
  "pdf_no_text",
  "unclassified_sensitive",
  "contradictory_sources",
  "ambiguous_manual_review",
]);

export const quarantineRiskLevelEnum = z.enum(["low", "medium", "high"]);

export const quarantineInputSchema = z.object({
  // run_id de la corrida del pipeline (se comparte con el aporte de staging).
  runId: z.uuid("run_id debe ser un UUID válido"),
  sourceSlug: z.string().trim().min(1, "source_slug es obligatorio"),
  // Trazabilidad libre: para fuentes manual_file/PDF el origen es una RUTA, no una
  // URL. No exigimos formato URL: rechazar el registro por eso seria perderlo, que
  // es justo lo que la cuarentena evita (#88). Es solo una pista para el revisor.
  sourceUrl: optionalText,
  reasonCode: quarantineReasonCodeEnum,
  reasonDetail: optionalText,
  riskLevel: quarantineRiskLevelEnum,
  // Fragmento YA redactado por el scraper (sin PII en claro), nunca el payload completo.
  payloadPreviewRedacted: optionalText,
  payloadHash: optionalHash,
  // Resumen de hallazgos PII: conteos por tipo, nunca valores en claro.
  piiFindingsSummary: z.preprocess(
    emptyToUndefined,
    z.record(z.string(), z.number()).optional(),
  ),
});

export type QuarantineInput = z.infer<typeof quarantineInputSchema>;

// ---------------------------------------------------------------------------
// source_watermarks — marca por fuente del último registro procesado (PUT).
// `watermarkAt` debe ser ISO 8601 con offset (UTC), como el resto del contrato.
// ---------------------------------------------------------------------------
export const watermarkInputSchema = z.object({
  watermarkAt: z.iso.datetime({ offset: true }),
});

export type WatermarkInput = z.infer<typeof watermarkInputSchema>;
