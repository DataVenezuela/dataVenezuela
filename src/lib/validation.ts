import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums (deben coincidir con los tipos del esquema SQL)
// ---------------------------------------------------------------------------
export const userRoleEnum = z.enum(["public_submitter", "scraper", "admin"]);

// ---------------------------------------------------------------------------
// Helpers: trata "" como ausente (los formularios envían strings vacíos)
// ---------------------------------------------------------------------------
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());

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
