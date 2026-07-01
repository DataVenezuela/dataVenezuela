/**
 * Normalización canónica para identificadores PII (cédulas venezolanas, teléfonos).
 *
 * Refleja la secuencia Python en
 *   VZLA_DEDUP/scrapers/normalizers/text.py::normalize_for_match
 *   seguido de ".replace(' ', '')"
 * para que se produzca la misma tokenización byte a byte en este repo y
 * en el scraper. El orden es sensible
 *   (NFKC -> minúsculas -> NFD eliminar Mn -> lista blanca
 *    -> colapsar/eliminar espacios);
 * no reordenar sin revalidar los vectores de compatibilidad Python
 * en `hash.test.ts`.
 *
 * Devuelve null cuando la entrada es nula o colapsa a vacío.
 */
export function normalizeIdentifier(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }

  // Paso 1: NFKC + colapsar espacios + recortar.
  let text = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (text.length === 0) {
    return null;
  }

  // Paso 2: minúsculas.
  text = text.toLowerCase();

  // Paso 3: NFD + eliminar marcas no espaciadoras (Mn) únicamente.
  // \p{Mn} coincide exactamente con unicodedata.category(ch) != "Mn" de Python,
  // y es más estricto que la clase completa \p{M}.
  text = text.normalize("NFD").replace(/\p{Mn}/gu, "");

  // Paso 4: lista blanca [a-z0-9áéíóúñü\s]; todo lo demás se convierte en espacio.
  text = text.replace(/[^a-z0-9áéíóúñü\s]/g, " ");

  // Paso 5: colapsar espacios + recortar; salir si no queda nada.
  text = text.replace(/\s+/g, " ").trim();
  if (text.length === 0) {
    return null;
  }

  // Paso 6: eliminar todos los espacios restantes.
  return text.replace(/ /g, "");
}

function assertSecret(
  secret: string | null | undefined,
): asserts secret is string {
  if (secret == null || secret.trim() === "") {
    // El mensaje de error nombra la variable de entorno o clave de configuración requerida,
    // pero nunca incluye el identificador crudo, para que nunca se filtre PII por logs.
    throw new Error("PII_HMAC_SECRET is required");
  }
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Tokenización HMAC-SHA256 determinista de un identificador PII canónico.
 *
 * Compatible con `VZLA_DEDUP/shared/hashing.py::identity_token`: la misma
 * entrada normalizada más el mismo secreto siempre producen el mismo token
 * hex en minúsculas, tanto en Node.js (>=24) como en Cloudflare Worker.
 *
 * Usa WebCrypto (`globalThis.crypto.subtle`) y nunca `node:crypto`, para que
 * el mismo módulo funcione en ambos runtimes sin condicionales de entorno.
 *
 * Devuelve null solo cuando el identificador falta o normaliza a vacío.
 * Lanza un `Error` cuyo mensaje nombra `PII_HMAC_SECRET` cuando el secreto
 * falta o es solo espacios; el mensaje nunca incluye el identificador crudo.
 */
export async function hashIdentifierHmac(
  value: string | null | undefined,
  secret: string | null | undefined,
): Promise<string | null> {
  // Validar el secreto primero para que un secreto faltante nunca toque
  // ni loguee el identificador crudo.
  assertSecret(secret);
  const canonical = normalizeIdentifier(value);
  if (canonical === null) {
    return null;
  }
  return hmacSha256Hex(canonical, secret);
}
