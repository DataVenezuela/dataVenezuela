import { describe, it, expect } from "vitest";
import { handleHealthz } from "../src/routes/healthz";
import type { Env } from "../src/env";

// Stubs minimos del binding D1 (solo lo que usa handleHealthz).
function dbReturning(value: string): Env["DB"] {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => ({ value }),
      }),
    }),
  } as unknown as Env["DB"];
}

function dbThrowing(): Env["DB"] {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => {
          throw new Error("no existe snapshot_metadata");
        },
      }),
    }),
  } as unknown as Env["DB"];
}

describe("handleHealthz", () => {
  it("responde ok:true sin D1", async () => {
    const res = await handleHealthz({});
    expect(res).toEqual({ ok: true });
  });

  it("incluye snapshot_version cuando la D1 lo provee", async () => {
    const res = await handleHealthz({ DB: dbReturning("2026-06-27T00:00:00Z") });
    expect(res.ok).toBe(true);
    expect(res.snapshot_version).toBe("2026-06-27T00:00:00Z");
  });

  it("mantiene ok:true si la consulta a D1 falla", async () => {
    const res = await handleHealthz({ DB: dbThrowing() });
    expect(res).toEqual({ ok: true });
  });

  it("no agrega campos fuera de HealthResponse", async () => {
    const res = await handleHealthz({ DB: dbReturning("v1") });
    expect(Object.keys(res).sort()).toEqual(["ok", "snapshot_version"]);
  });
});
