import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock de la autenticación: evita tocar Supabase. Por defecto autentica.
vi.mock("@/lib/partners", () => ({
  authenticatePartner: vi.fn(),
}));

import { authenticatePartner } from "@/lib/partners";
import { createIngestHandler } from "@/lib/dedup/handler";
import { ReferenceNotFoundError } from "@/lib/dedup/service";

const authMock = vi.mocked(authenticatePartner);

const schema = z.object({ name: z.string().min(1) });

function makeRequest(body: unknown, withKey = true) {
  return new Request("http://test.local/api/v1/dedup/things", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(withKey ? { "x-api-key": "k" } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const partner = { apiKeyId: "a", scraperId: "s1", name: "demo" };

beforeEach(() => {
  authMock.mockReset();
  authMock.mockResolvedValue(partner);
});

describe("createIngestHandler", () => {
  it("201 con id en creación exitosa", async () => {
    const POST = createIngestHandler(
      schema,
      async () => ({ id: "new-id" }),
      "/x",
    );
    const res = await POST(makeRequest({ name: "ok" }));
    expect(res.status).toBe(201);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    await expect(res.json()).resolves.toEqual({
      id: "new-id",
      status: "created",
    });
  });

  it("401 sin API key", async () => {
    authMock.mockResolvedValue(null);
    const POST = createIngestHandler(schema, async () => ({ id: "x" }), "/x");
    const res = await POST(makeRequest({ name: "ok" }, false));
    expect(res.status).toBe(401);
  });

  it("400 con JSON inválido", async () => {
    const POST = createIngestHandler(schema, async () => ({ id: "x" }), "/x");
    const res = await POST(makeRequest("{not-json"));
    expect(res.status).toBe(400);
  });

  it("422 cuando el contrato no valida", async () => {
    const POST = createIngestHandler(schema, async () => ({ id: "x" }), "/x");
    const res = await POST(makeRequest({ name: "" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Datos inválidos");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("404 cuando una FK no existe", async () => {
    const POST = createIngestHandler(
      schema,
      async () => {
        throw new ReferenceNotFoundError("event_id", "missing");
      },
      "/x",
    );
    const res = await POST(makeRequest({ name: "ok" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.field).toBe("event_id");
  });

  it("500 ante error inesperado del servicio", async () => {
    const POST = createIngestHandler(
      schema,
      async () => {
        throw new Error("boom");
      },
      "/x",
    );
    const res = await POST(makeRequest({ name: "ok" }));
    expect(res.status).toBe(500);
  });
});
