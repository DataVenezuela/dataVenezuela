import { describe, expect, it } from "vitest";
import {
  acopioCenterInputSchema,
  eventInputSchema,
  personInputSchema,
  personSourceInputSchema,
} from "@/lib/dedup/validation";

const EVENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const HMAC = "a".repeat(64);

describe("eventInputSchema", () => {
  it("acepta un evento válido", () => {
    const r = eventInputSchema.safeParse({
      name: "Terremoto Yaracuy",
      event_type: "earthquake",
      occurred_at: "2026-06-24T12:00:00Z",
      status: "active",
      magnitude: 5.4,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza event_type fuera del enum", () => {
    const r = eventInputSchema.safeParse({
      name: "X",
      event_type: "tsunami",
      occurred_at: "2026-06-24T12:00:00Z",
      status: "active",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza occurred_at no ISO", () => {
    const r = eventInputSchema.safeParse({
      name: "X",
      event_type: "flood",
      occurred_at: "2026-06-24",
      status: "active",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza name vacío", () => {
    const r = eventInputSchema.safeParse({
      name: "  ",
      event_type: "flood",
      occurred_at: "2026-06-24T12:00:00Z",
      status: "active",
    });
    expect(r.success).toBe(false);
  });
});

describe("personInputSchema", () => {
  const base = {
    event_id: EVENT_ID,
    status: "missing",
    verification_status: "unverified",
  };

  it("acepta una persona válida con HMAC y null en campos opcionales", () => {
    const r = personInputSchema.safeParse({
      ...base,
      full_name: "juan perez",
      cedula_hmac: HMAC,
      cedula_masked: "V-****5821",
      confidence_score: 0.75,
      sex: null,
      is_minor: null,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza confidence_score fuera de [0,1]", () => {
    const r = personInputSchema.safeParse({ ...base, confidence_score: 1.5 });
    expect(r.success).toBe(false);
  });

  it("rechaza cedula_hmac mal formado", () => {
    const r = personInputSchema.safeParse({ ...base, cedula_hmac: "xyz" });
    expect(r.success).toBe(false);
  });

  it("rechaza event_id no UUID", () => {
    const r = personInputSchema.safeParse({ ...base, event_id: "no-uuid" });
    expect(r.success).toBe(false);
  });

  it("rechaza sex fuera del enum", () => {
    const r = personInputSchema.safeParse({ ...base, sex: "otro" });
    expect(r.success).toBe(false);
  });
});

describe("personSourceInputSchema", () => {
  const base = {
    person_record_id: EVENT_ID,
    source_url: "https://example.org/x",
  };

  it("acepta trust_tier válido", () => {
    const r = personSourceInputSchema.safeParse({ ...base, trust_tier: 2 });
    expect(r.success).toBe(true);
  });

  it("rechaza trust_tier inválido", () => {
    const r = personSourceInputSchema.safeParse({ ...base, trust_tier: 4 });
    expect(r.success).toBe(false);
  });

  it("rechaza source_url no URL", () => {
    const r = personSourceInputSchema.safeParse({
      person_record_id: EVENT_ID,
      source_url: "no-es-url",
      trust_tier: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe("acopioCenterInputSchema needs[]", () => {
  it("mapea keywords desconocidas a 'otro'", () => {
    const r = acopioCenterInputSchema.safeParse({
      event_id: EVENT_ID,
      name: "Centro 1",
      status: "active",
      needs: ["agua", "pizza", "alimentos"],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.needs).toEqual(["agua", "otro", "alimentos"]);
  });
});
