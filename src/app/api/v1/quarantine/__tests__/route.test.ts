import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/partners", () => ({ authenticatePartner: vi.fn() }));
vi.mock("@/lib/services/quarantine", () => ({
  createQuarantineRecord: vi.fn(),
}));

import { authenticatePartner } from "@/lib/partners";
import { SourceOwnershipError } from "@/lib/services/aportes";
import { createQuarantineRecord } from "@/lib/services/quarantine";
import { POST } from "@/app/api/v1/quarantine/route";

const authMock = vi.mocked(authenticatePartner);
const createMock = vi.mocked(createQuarantineRecord);
const partner = { apiKeyId: "a", scraperId: "s1", name: "demo" };

function makeRequest(body: unknown, withKey = true) {
  return new Request("http://test.local/api/v1/quarantine", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(withKey ? { "x-api-key": "k" } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset().mockResolvedValue(partner);
  createMock.mockReset().mockResolvedValue("q1");
});

describe("POST /api/v1/quarantine", () => {
  it("201 con un registro válido", async () => {
    const res = await POST(
      makeRequest({
        sourceSlug: "funvisis",
        reasonCode: "parser_missing",
        riskLevel: "medium",
        payloadHash: "a".repeat(64),
        payloadPreviewRedacted: "texto redactado",
      }),
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      id: "q1",
      status: "quarantined",
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSlug: "funvisis",
        reasonCode: "parser_missing",
        riskLevel: "medium",
      }),
      { scraperId: "s1" },
    );
  });

  it("422 si faltan campos obligatorios", async () => {
    const res = await POST(makeRequest({ sourceSlug: "funvisis" }));

    expect(res.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("403 cuando la fuente no pertenece al scraper", async () => {
    createMock.mockRejectedValue(new SourceOwnershipError());
    const res = await POST(
      makeRequest({
        sourceSlug: "ajena",
        reasonCode: "schema_invalid",
        riskLevel: "high",
      }),
    );

    expect(res.status).toBe(403);
  });

  it("400 con JSON inválido", async () => {
    const res = await POST(makeRequest("{not-json"));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("401 sin API key", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(
      makeRequest(
        { sourceSlug: "funvisis", reasonCode: "parser_missing", riskLevel: "low" },
        false,
      ),
    );

    expect(res.status).toBe(401);
  });
});
