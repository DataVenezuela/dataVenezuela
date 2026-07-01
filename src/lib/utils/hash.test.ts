import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { hashIdentifierHmac, normalizeIdentifier } from "@/lib/utils/hash";

// Leer el fuente del módulo estáticamente para que el guard de portabilidad sea
// comprobable sin depender de que la implementación esté cargada.
const SOURCE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "./hash.ts",
);
const SOURCE = readFileSync(SOURCE_PATH, "utf-8");

const SECRET = "test-secret-1234567890";

describe("normalizeIdentifier", () => {
  it("collapses equivalent formatted cedula variants to the same canonical", () => {
    const canonical = normalizeIdentifier("V-12.345.678");
    expect(canonical).toBe("v12345678");
    expect(normalizeIdentifier("V12345678")).toBe(canonical);
    expect(normalizeIdentifier("v 12 345 678")).toBe(canonical);
    expect(normalizeIdentifier("V-12345678")).toBe(canonical);
    expect(normalizeIdentifier("v12345678")).toBe(canonical);
    expect(normalizeIdentifier("  V--12..345.678  ")).toBe(canonical);
  });

  it("strips punctuation and repeated whitespace", () => {
    expect(normalizeIdentifier("  V--12..345.678  ")).toBe("v12345678");
  });

  it("strips accents and combining marks (Nonspacing, Mn)", () => {
    expect(normalizeIdentifier("José")).toBe("jose");
    expect(normalizeIdentifier("MARÍA")).toBe("maria");
    expect(normalizeIdentifier("V-ÁÉÍÓÚÑÜ-12")).toBe("vaeiounu12");
  });

  it("keeps only characters in the allowlist, dropping everything else", () => {
    // Letras + dígitos + espacios se conservan; la puntuación se vuelve espacio
    // y luego se colapsa. El resultado no tiene espacios.
    const out = normalizeIdentifier("Hello 123! @#z");
    expect(out).toBe("hello123z");
  });

  it("returns null for null, undefined, empty, whitespace-only, and punctuation-only inputs", () => {
    expect(normalizeIdentifier(null)).toBeNull();
    expect(normalizeIdentifier(undefined)).toBeNull();
    expect(normalizeIdentifier("")).toBeNull();
    expect(normalizeIdentifier("   ")).toBeNull();
    expect(normalizeIdentifier("\t\n")).toBeNull();
    expect(normalizeIdentifier("...")).toBeNull();
    expect(normalizeIdentifier("___")).toBeNull();
  });
});

describe("hashIdentifierHmac", () => {
  it("is deterministic for the same input and secret", async () => {
    const a = await hashIdentifierHmac("V-12.345.678", SECRET);
    const b = await hashIdentifierHmac("V-12.345.678", SECRET);
    expect(a).toBe(b);
  });

  it("returns identical tokens for semantically equivalent inputs", async () => {
    const a = await hashIdentifierHmac("V-12.345.678", SECRET);
    const b = await hashIdentifierHmac("V12345678", SECRET);
    const c = await hashIdentifierHmac("v 12 345 678", SECRET);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different tokens for different secrets", async () => {
    const a = await hashIdentifierHmac(
      "V12345678",
      "secret-aaaaaaaaaaaaaaaaaaaaa",
    );
    const b = await hashIdentifierHmac(
      "V12345678",
      "secret-bbbbbbbbbbbbbbbbbbbbb",
    );
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns 64 lowercase hex characters with no prefix or whitespace", async () => {
    const out = await hashIdentifierHmac("V12345678", SECRET);
    expect(out).not.toBeNull();
    expect(out).toHaveLength(64);
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns null for null, undefined, empty, and whitespace-only identifiers", async () => {
    expect(await hashIdentifierHmac(null, SECRET)).toBeNull();
    expect(await hashIdentifierHmac(undefined, SECRET)).toBeNull();
    expect(await hashIdentifierHmac("", SECRET)).toBeNull();
    expect(await hashIdentifierHmac("   ", SECRET)).toBeNull();
  });

  it("throws an explicit error when the secret is missing or whitespace-only", async () => {
    const identifier = "V12345678";
    await expect(hashIdentifierHmac(identifier, "")).rejects.toThrow(
      /PII_HMAC_SECRET/,
    );
    await expect(hashIdentifierHmac(identifier, "   ")).rejects.toThrow(
      /PII_HMAC_SECRET/,
    );
    await expect(hashIdentifierHmac(identifier, null)).rejects.toThrow(
      /PII_HMAC_SECRET/,
    );
    await expect(hashIdentifierHmac(identifier, undefined)).rejects.toThrow(
      /PII_HMAC_SECRET/,
    );
  });

  it("does not include the raw identifier in the thrown error", async () => {
    const sensitive = "V-SECRET-PII-DO-NOT-LEAK-12345";
    let captured: unknown;
    try {
      await hashIdentifierHmac(sensitive, "");
    } catch (err) {
      captured = err;
    }
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).not.toContain(sensitive);
  });
});

describe("Python compatibility vectors (VZLA_DEDUP/shared/hashing.py)", () => {
  // Todos los vectores calculados con secret = "test-secret-1234567890"
  // usando normalize_for_match + ".replace(' ', '')" y hmac(secret, norm, sha256).hexdigest().
  it("matches the Python HMAC for the canonical 'v12345678'", async () => {
    const out = await hashIdentifierHmac(
      "V-12.345.678",
      "test-secret-1234567890",
    );
    expect(out).toBe(
      "370fb3731688319629616792957bc7b2691c7cf03edec21a7fa6adccb8eaab66",
    );
  });

  it("matches the Python HMAC for an accented compound value", async () => {
    const out = await hashIdentifierHmac(
      "V-12.345.678-José",
      "test-secret-1234567890",
    );
    expect(out).toBe(
      "e302047bdd28ff61ca1b244d630a32a9af29b99d715d5b5fd8aa3113fa2a45e6",
    );
  });

  it("matches the Python HMAC for an all-accented input", async () => {
    const out = await hashIdentifierHmac(
      "V-ÁÉÍÓÚÑÜ-12",
      "test-secret-1234567890",
    );
    expect(out).toBe(
      "380835f9fc098baffe5d02d7bea1d480017ff1d4911a22e72ef796441b0d061b",
    );
  });
});

describe("runtime portability guard", () => {
  it("does not import node:crypto anywhere in the module source", () => {
    // Verificación estática del fuente: el mismo fuente debe ejecutarse sin cambios en
    // Cloudflare Workers, que no tiene node:crypto.
    expect(SOURCE).not.toMatch(/from\s+["']node:crypto["']/);
    expect(SOURCE).not.toMatch(/require\(\s*["']node:crypto["']\s*\)/);
  });

  it("does not emit any console output from the module source", () => {
    // Utilidad PII pura: sin logging, para que identificadores crudos no
    // puedan filtrarse accidentalmente por efectos secundarios de console.*.
    expect(SOURCE).not.toMatch(/console\.(log|info|warn|error|debug)/);
  });
});
