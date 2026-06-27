// Enums y keywords controladas del esquema normalizado Vzla_Dedup.
// Fuente única de verdad para los schemas de validación y los tests; deben
// coincidir con los CHECK de supabase/migrations/0004_dedup_schema.sql.

export const EVENT_TYPE = ["earthquake", "flood", "landslide", "other"] as const;
export const EVENT_STATUS = ["active", "monitoring", "closed"] as const;

export const PERSON_STATUS = [
  "missing",
  "found",
  "injured",
  "deceased",
  "unknown",
] as const;
export const VERIFICATION_STATUS = [
  "unverified",
  "pending",
  "verified",
  "conflicting",
] as const;
export const SEX = ["M", "F", "unknown"] as const;

export const NOTE_TYPE = ["missing", "injured", "found", "deceased"] as const;
export const NOTE_STATUS = ["active", "superseded", "retracted"] as const;
export const SEVERITY = [
  "leve",
  "moderado",
  "grave",
  "critico",
  "unknown",
] as const;
export const IDENTIFICATION_STATUS = [
  "identified",
  "unidentified",
  "pending",
] as const;

export const ACOPIO_STATUS = ["active", "full", "closed", "unverified"] as const;

export const TRUST_TIER = [1, 2, 3] as const;

// Keywords controladas para `needs[]`. Cualquier valor fuera de esta lista se
// mapea a "otro" (fallback del spec); el mapeo texto-libre vive en el parser.
export const NEEDS_KEYWORDS = [
  "agua",
  "alimentos",
  "medicamentos",
  "colchonetas",
  "ropa",
  "calzado",
  "higiene",
  "pañales",
  "leche_formula",
  "generador",
  "combustible",
  "herramientas",
  "voluntarios",
  "transporte",
  "otro",
] as const;

export const NEEDS_FALLBACK = "otro";
