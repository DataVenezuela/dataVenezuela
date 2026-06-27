import { z } from "zod";
import { emptyToUndefined } from "@/lib/validation";
import {
  ACOPIO_STATUS,
  EVENT_STATUS,
  EVENT_TYPE,
  IDENTIFICATION_STATUS,
  NEEDS_FALLBACK,
  NEEDS_KEYWORDS,
  NOTE_STATUS,
  NOTE_TYPE,
  PERSON_STATUS,
  SEVERITY,
  SEX,
  TRUST_TIER,
  VERIFICATION_STATUS,
} from "@/lib/dedup/enums";

// ---------------------------------------------------------------------------
// Helpers — los campos opcionales aceptan ausencia, "" y null (los scrapers
// suelen mandar null explícito). Todos se normalizan a undefined y el servicio
// los persiste como null en la base.
// ---------------------------------------------------------------------------
const blankToUndefined = (v: unknown) =>
  v === null ? undefined : emptyToUndefined(v);
const nullToUndefined = (v: unknown) => (v === null ? undefined : v);

const optText = z.preprocess(blankToUndefined, z.string().optional());
const optUrl = z.preprocess(blankToUndefined, z.url().optional());
const optBool = z.preprocess(nullToUndefined, z.boolean().optional());
const optNum = z.preprocess(nullToUndefined, z.number().optional());
const optInt = z.preprocess(nullToUndefined, z.number().int().optional());
const optJson = z.preprocess(nullToUndefined, z.unknown().optional());

// timestamptz: ISO 8601 con o sin offset (UTC). El spec exige UTC.
const reqTimestamp = z.iso.datetime({ offset: true });
const optTimestamp = z.preprocess(
  blankToUndefined,
  z.iso.datetime({ offset: true }).optional(),
);

// HMAC pre-calculado por el scraper: SHA-256 en hex (64 chars). El API nunca
// recibe PII cruda, sólo valida el formato.
const optHmac = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^[0-9a-f]{64}$/, "debe ser hex SHA-256 (64 caracteres)")
    .optional(),
);

// confidence_score: numeric(4,3) en rango [0.000, 1.000].
const optConfidence = z.preprocess(
  nullToUndefined,
  z.number().min(0, "confidence_score >= 0").max(1, "confidence_score <= 1").optional(),
);

const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values).optional());

// trust_tier: 1=oficial · 2=ONG · 3=social/anónimo.
const trustTier = z
  .number()
  .int()
  .refine((n): n is 1 | 2 | 3 => (TRUST_TIER as readonly number[]).includes(n), {
    message: "trust_tier debe ser 1, 2 o 3",
  });

// needs[]: keywords controladas; cualquier valor desconocido cae en "otro".
const optNeeds = z.preprocess(
  nullToUndefined,
  z
    .array(z.string())
    .transform((arr) =>
      arr.map((k) =>
        (NEEDS_KEYWORDS as readonly string[]).includes(k) ? k : NEEDS_FALLBACK,
      ),
    )
    .optional(),
);

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------
export const eventInputSchema = z.object({
  name: z.string().trim().min(1, "name es obligatorio"),
  event_type: z.enum(EVENT_TYPE),
  occurred_at: reqTimestamp,
  affected_states: optJson,
  magnitude: optNum,
  depth_km: optNum,
  status: z.enum(EVENT_STATUS),
  external_ids: optJson,
});
export type EventInput = z.infer<typeof eventInputSchema>;

// ---------------------------------------------------------------------------
// persons
// ---------------------------------------------------------------------------
export const personInputSchema = z.object({
  event_id: z.uuid(),
  full_name: optText,
  alternate_names: optJson,
  cedula_hmac: optHmac,
  cedula_masked: z.preprocess(blankToUndefined, z.string().max(15).optional()),
  age_range: optJson,
  sex: optEnum(SEX),
  is_minor: optBool,
  last_known_location: optJson,
  status: z.enum(PERSON_STATUS),
  verification_status: z.enum(VERIFICATION_STATUS),
  confidence_score: optConfidence,
  source_url: optUrl,
});
export type PersonInput = z.infer<typeof personInputSchema>;

// ---------------------------------------------------------------------------
// person_notes — columnas sparse por note_type; se aceptan todas (la
// correlación estricta tipo↔campos queda fuera de alcance, ver docs).
// ---------------------------------------------------------------------------
export const personNoteInputSchema = z.object({
  person_record_id: z.uuid(),
  note_type: z.enum(NOTE_TYPE),
  found_by: optText,
  status: z.enum(NOTE_STATUS),
  source_date: optTimestamp,
  entry_date: optTimestamp,
  found: optBool,
  last_known_location: optJson,
  // sparse: missing
  last_seen_at: optTimestamp,
  last_seen_location: optJson,
  // sparse: injured
  hospital_name: optText,
  hospital_municipio: optText,
  severity: optEnum(SEVERITY),
  admitted_time: optTimestamp,
  // sparse: found
  found_at: optTimestamp,
  // sparse: deceased
  deceased_at: optTimestamp,
  recovery_location: optJson,
  identification_status: optEnum(IDENTIFICATION_STATUS),
  confirmed_by: optText,
});
export type PersonNoteInput = z.infer<typeof personNoteInputSchema>;

// ---------------------------------------------------------------------------
// person_sources
// ---------------------------------------------------------------------------
export const personSourceInputSchema = z.object({
  person_record_id: z.uuid(),
  source_url: z.url(),
  ext_id: optText,
  trust_tier: trustTier,
  fetched_at: optTimestamp,
});
export type PersonSourceInput = z.infer<typeof personSourceInputSchema>;

// ---------------------------------------------------------------------------
// person_photos
// ---------------------------------------------------------------------------
export const personPhotoInputSchema = z.object({
  person_record_id: z.uuid(),
  url: z.url(),
  caption: optText,
  source_id: z.preprocess(blankToUndefined, z.uuid().optional()),
  uploaded_at: optTimestamp,
});
export type PersonPhotoInput = z.infer<typeof personPhotoInputSchema>;

// ---------------------------------------------------------------------------
// acopio_centers
// ---------------------------------------------------------------------------
export const acopioCenterInputSchema = z.object({
  event_id: z.uuid(),
  name: z.string().trim().min(1, "name es obligatorio"),
  location: optJson,
  confidence_score: optConfidence,
  status: z.enum(ACOPIO_STATUS),
  needs: optNeeds,
  last_verified_at: optTimestamp,
  managing_org: optText,
  contact_hmac: optHmac,
  contact_masked: z.preprocess(blankToUndefined, z.string().max(30).optional()),
  capacity: optInt,
  current_load: optInt,
});
export type AcopioCenterInput = z.infer<typeof acopioCenterInputSchema>;
