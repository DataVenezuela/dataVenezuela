import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks: auth y capa de servicio. Ningún test toca Supabase / red.
vi.mock("@/lib/partners", () => ({ authenticatePartner: vi.fn() }));
vi.mock("@/lib/services/source-watermarks", () => ({
  getWatermark: vi.fn(),
  setWatermark: vi.fn(),
  WATERMARK_DEFAULT: "1970-01-01T00:00:00Z",
}));

import { authenticatePartner } from "@/lib/partners";
import {
  getWatermark,
  setWatermark,
  WATERMARK_DEFAULT,
} from "@/lib/services/source-watermarks";
import { SourceOwnershipError } from "@/lib/services/aportes";
import { GET, PUT } from "@/app/api/source-watermarks/[slug]/route";

const authMock = vi.mocked(authenticatePartner);
const getMock = vi.mocked(getWatermark);
const setMock = vi.mocked(setWatermark);

const partner = { apiKeyId: "a", scraperId: "s1", name: "demo" };
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

function makeRequest(body?: unknown, withKey = true) {
  return new Request("http://test.local/api/source-watermarks/funvisis", {
    method: body === undefined ? "GET" : "PUT",
    headers: {
      "content-type": "application/json",
      ...(withKey ? { "x-api-key": "k" } : {}),
    },
    ...(body !== undefined
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
}

beforeEach(() => {
  authMock.mockReset().mockResolvedValue(partner);
  getMock.mockReset();
  setMock.mockReset();
});

describe("GET /api/source-watermarks/{slug}", () => {
  it("200 con el default cuando la fuente propia no tiene fila", async () => {
    getMock.mockResolvedValue(WATERMARK_DEFAULT);
    const res = await GET(makeRequest(), params("funvisis"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      sourceSlug: "funvisis",
      watermarkAt: WATERMARK_DEFAULT,
    });
  });

  it("403 cuando la fuente es ajena", async () => {
    getMock.mockRejectedValue(new SourceOwnershipError());
    const res = await GET(makeRequest(), params("ajena"));
    expect(res.status).toBe(403);
  });

  it("401 sin API key", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(makeRequest(undefined, false), params("funvisis"));
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/source-watermarks/{slug}", () => {
  it("200 con el valor guardado tras un upsert válido", async () => {
    setMock.mockResolvedValue("2026-06-28T00:00:00Z");
    const res = await PUT(
      makeRequest({ watermarkAt: "2026-06-28T00:00:00Z" }),
      params("funvisis"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      sourceSlug: "funvisis",
      watermarkAt: "2026-06-28T00:00:00Z",
    });
    expect(setMock).toHaveBeenCalledWith("funvisis", "2026-06-28T00:00:00Z", {
      scraperId: "s1",
    });
  });

  it("422 con un watermarkAt inválido", async () => {
    const res = await PUT(
      makeRequest({ watermarkAt: "2026-06-28" }),
      params("funvisis"),
    );
    expect(res.status).toBe(422);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("400 con JSON inválido", async () => {
    const res = await PUT(makeRequest("{not-json"), params("funvisis"));
    expect(res.status).toBe(400);
  });

  it("403 cuando la fuente es ajena", async () => {
    setMock.mockRejectedValue(new SourceOwnershipError());
    const res = await PUT(
      makeRequest({ watermarkAt: "2026-06-28T00:00:00Z" }),
      params("ajena"),
    );
    expect(res.status).toBe(403);
  });

  it("401 sin API key", async () => {
    authMock.mockResolvedValue(null);
    const res = await PUT(
      makeRequest({ watermarkAt: "2026-06-28T00:00:00Z" }, false),
      params("funvisis"),
    );
    expect(res.status).toBe(401);
  });
});
