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
// source_watermarks — marca por fuente del último registro procesado (PUT).
// `watermarkAt` debe ser ISO 8601 con offset (UTC), como el resto del contrato.
// ---------------------------------------------------------------------------
export const watermarkInputSchema = z.object({
  watermarkAt: z.iso.datetime({ offset: true }),
});

export type WatermarkInput = z.infer<typeof watermarkInputSchema>;

// ---------------------------------------------------------------------------
// quarantine_records — registros que el pipeline no puede procesar con seguridad.
// El payload debe venir redactado; nunca PII cruda.
// ---------------------------------------------------------------------------
export const quarantineInputSchema = z.object({
  sourceSlug: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1, "sourceSlug es obligatorio"),
  ),
  runId: optionalUuid,
  sourceUrl: optionalUrl,
  reasonCode: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1, "reasonCode es obligatorio"),
  ),
  reasonDetail: optionalText,
  riskLevel: z.enum(["low", "medium", "high"]),
  payloadPreviewRedacted: optionalText,
  payloadHash: optionalHash,
  piiFindingsSummary: z.unknown().optional(),
  retentionUntil: z.preprocess(
    emptyToUndefined,
    z.iso.datetime({ offset: true }).optional(),
  ),
});

export type QuarantineInput = z.infer<typeof quarantineInputSchema>;
