import { createHash, randomBytes } from "node:crypto";

/**
 * Hash de una API key de aliado: sha256(key + PARTNER_API_SALT).
 * Solo se guarda el hash en partner_api_keys.key_hash; la key en claro nunca
 * se persiste. Server-only (usa node:crypto).
 */
export function hashApiKey(key: string): string {
  const salt = process.env.PARTNER_API_SALT ?? "";
  return createHash("sha256").update(`${key}${salt}`).digest("hex");
}

/**
 * Genera una API key nueva en claro (prefijo `dv_` + 32 bytes hex).
 * Solo se muestra una vez al scraper; se persiste únicamente su hash.
 */
export function generateApiKey(): string {
  return `dv_${randomBytes(32).toString("hex")}`;
}
