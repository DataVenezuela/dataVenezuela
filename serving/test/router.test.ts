import { describe, it, expect } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";

const env: Env = {};
const ctx = {} as ExecutionContext;

describe("worker fetch", () => {
  it("GET /healthz responde 200 con { ok: true }", async () => {
    const res = await worker.fetch(new Request("https://example.com/healthz"), env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("ruta desconocida responde 404", async () => {
    const res = await worker.fetch(new Request("https://example.com/nope"), env, ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
