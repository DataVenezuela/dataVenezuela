import { describe, expect, it } from "vitest";
import { aporteInputSchema, watermarkInputSchema } from "@/lib/validation";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const HEX = "a".repeat(64);

describe("aporteInputSchema — campos de dedup", () => {
  const base = { sourceSlug: "funvisis", externalId: "fp1", rawJson: {} };

  it("acepta un payload con todos los campos de dedup", () => {
    const r = aporteInputSchema.safeParse({
      ...base,
      runId: UUID,
      entityType: "event",
      dedupHash: HEX,
      dedupVersion: "v1",
      blockKeys: ["b1", "b2"],
      contentHash: HEX,
      sourceRecordId: "rec-1",
      sourceUrl: "https://funvisis.gob.ve/sismo/1",
      parserVersion: "p1",
      normalizerVersion: "n1",
      rawArtifactId: UUID,
    });
    expect(r.success).toBe(true);
  });

  it("sigue aceptando un payload SIN los campos nuevos (compat hacia atrás)", () => {
    const r = aporteInputSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("rechaza dedupHash que no es hex", () => {
    const r = aporteInputSchema.safeParse({ ...base, dedupHash: "ZZZ" });
    expect(r.success).toBe(false);
  });

  it("rechaza entityType fuera del enum", () => {
    const r = aporteInputSchema.safeParse({ ...base, entityType: "vehicle" });
    expect(r.success).toBe(false);
  });

  it("rechaza sourceUrl que no es URL", () => {
    const r = aporteInputSchema.safeParse({ ...base, sourceUrl: "no-url" });
    expect(r.success).toBe(false);
  });

  it("rechaza runId que no es UUID", () => {
    const r = aporteInputSchema.safeParse({ ...base, runId: "abc" });
    expect(r.success).toBe(false);
  });
});

describe("watermarkInputSchema", () => {
  it("acepta un ISO 8601 con offset (UTC)", () => {
    const r = watermarkInputSchema.safeParse({
      watermarkAt: "2026-06-28T00:00:00Z",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza una fecha suelta sin hora", () => {
    const r = watermarkInputSchema.safeParse({ watermarkAt: "2026-06-28" });
    expect(r.success).toBe(false);
  });

  it("rechaza ausencia de watermarkAt", () => {
    const r = watermarkInputSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});
