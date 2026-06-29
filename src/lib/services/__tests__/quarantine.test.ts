import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock del cliente service-role: evita tocar Supabase / red. Cada test inyecta las
// respuestas de las llamadas terminales (.maybeSingle / .single) y captura el insert.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createQuarantineRecord,
  SourceOwnershipError,
} from "@/lib/services/quarantine";

const adminMock = vi.mocked(createAdminClient);

type MaybeSingle = { data: unknown };
type Single = { data: unknown; error: { code?: string; message: string } | null };

function makeSupabase(opts: {
  maybeSingleQueue: MaybeSingle[];
  singleResult?: Single;
}) {
  const captured: { insert?: Record<string, unknown> } = {};
  const queue = [...opts.maybeSingleQueue];
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    insert: (payload: Record<string, unknown>) => {
      captured.insert = payload;
      return builder;
    },
    maybeSingle: () => Promise.resolve(queue.shift()),
    single: () => Promise.resolve(opts.singleResult),
  };
  const client = { from: () => builder };
  return { client, captured };
}

const SCRAPER = "scraper-1";
const RUN_ID = "22222222-2222-4222-8222-222222222222";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    runId: RUN_ID,
    sourceSlug: "encuentralos",
    sourceUrl: "https://fuente.org/registro/1",
    reasonCode: "invalid_schema",
    reasonDetail: "Error parseando pagina 2",
    riskLevel: "medium",
    payloadPreviewRedacted: "fragmento [IDENTITY_DOCUMENT]",
    payloadHash: "a".repeat(64),
    piiFindingsSummary: { identity_document: 1 },
    ...overrides,
  } as never;
}

beforeEach(() => {
  adminMock.mockReset();
});

describe("createQuarantineRecord", () => {
  it("persiste cada campo en su columna snake_case (fuente propia, sin duplicado)", async () => {
    const { client, captured } = makeSupabase({
      // 1) fuente propia encontrada · 2) sin duplicado previo
      maybeSingleQueue: [{ data: { slug: "encuentralos" } }, { data: null }],
      singleResult: { data: { quarantine_id: "q-new" }, error: null },
    });
    adminMock.mockReturnValue(client as never);

    const res = await createQuarantineRecord(validInput(), { scraperId: SCRAPER });

    expect(res).toEqual({ quarantineId: "q-new", duplicate: false });
    expect(captured.insert).toMatchObject({
      run_id: RUN_ID,
      source_slug: "encuentralos",
      source_url: "https://fuente.org/registro/1",
      reason_code: "invalid_schema",
      reason_detail: "Error parseando pagina 2",
      risk_level: "medium",
      payload_preview_redacted: "fragmento [IDENTITY_DOCUMENT]",
      payload_hash: "a".repeat(64),
      pii_findings_summary: { identity_document: 1 },
    });
    // No se persiste scraper_id (atribucion via ownership de la fuente).
    expect(captured.insert).not.toHaveProperty("scraper_id");
  });

  it("fuente ajena o inexistente lanza SourceOwnershipError (-> 403)", async () => {
    const { client, captured } = makeSupabase({
      maybeSingleQueue: [{ data: null }], // ownership: no encontrada
    });
    adminMock.mockReturnValue(client as never);

    await expect(
      createQuarantineRecord(validInput(), { scraperId: SCRAPER }),
    ).rejects.toBeInstanceOf(SourceOwnershipError);
    expect(captured.insert).toBeUndefined();
  });

  it("reenviar el mismo (source, payload_hash) devuelve duplicate sin insertar", async () => {
    const { client, captured } = makeSupabase({
      // 1) fuente propia · 2) duplicado existente
      maybeSingleQueue: [
        { data: { slug: "encuentralos" } },
        { data: { quarantine_id: "q-existing" } },
      ],
    });
    adminMock.mockReturnValue(client as never);

    const res = await createQuarantineRecord(validInput(), { scraperId: SCRAPER });

    expect(res).toEqual({ quarantineId: "q-existing", duplicate: true });
    expect(captured.insert).toBeUndefined();
  });

  it("trata un 23505 en el insert como duplicado (carrera concurrente)", async () => {
    const { client } = makeSupabase({
      // 1) fuente propia · 2) sin dup al chequear · 3) tras 23505, se relee y existe
      maybeSingleQueue: [
        { data: { slug: "encuentralos" } },
        { data: null },
        { data: { quarantine_id: "q-race" } },
      ],
      singleResult: {
        data: null,
        error: { code: "23505", message: "duplicate key" },
      },
    });
    adminMock.mockReturnValue(client as never);

    const res = await createQuarantineRecord(validInput(), { scraperId: SCRAPER });

    expect(res).toEqual({ quarantineId: "q-race", duplicate: true });
  });

  it("sin payload_hash inserta directo (no hay dedup posible)", async () => {
    const { client, captured } = makeSupabase({
      maybeSingleQueue: [{ data: { slug: "encuentralos" } }],
      singleResult: { data: { quarantine_id: "q-no-hash" }, error: null },
    });
    adminMock.mockReturnValue(client as never);

    const res = await createQuarantineRecord(
      validInput({ payloadHash: undefined }),
      { scraperId: SCRAPER },
    );

    expect(res).toEqual({ quarantineId: "q-no-hash", duplicate: false });
    expect(captured.insert).toMatchObject({ payload_hash: null });
  });

  it("propaga error no-23505 del insert", async () => {
    const { client } = makeSupabase({
      maybeSingleQueue: [{ data: { slug: "encuentralos" } }, { data: null }],
      singleResult: {
        data: null,
        error: { code: "42P01", message: "relation does not exist" },
      },
    });
    adminMock.mockReturnValue(client as never);

    await expect(
      createQuarantineRecord(validInput(), { scraperId: SCRAPER }),
    ).rejects.toThrow(/createQuarantineRecord failed/);
  });
});
