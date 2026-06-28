import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock del cliente service-role: evita tocar Supabase / red. Cada test inyecta las
// respuestas de las llamadas terminales (.maybeSingle / .single) y captura el insert.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { createAporte } from "@/lib/services/aportes";

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

beforeEach(() => {
  adminMock.mockReset();
});

describe("createAporte — campos de dedup", () => {
  it("persiste cada campo de dedup en su columna snake_case", async () => {
    const { client, captured } = makeSupabase({
      // 1) fuente encontrada · 2) sin duplicado previo
      maybeSingleQueue: [{ data: { id: "src-1" } }, { data: null }],
      singleResult: { data: { id: "new-id" }, error: null },
    });
    adminMock.mockReturnValue(client as never);

    const res = await createAporte(
      {
        sourceId: "11111111-1111-4111-8111-111111111111",
        externalId: "fp1",
        rawJson: { a: 1 },
        runId: "22222222-2222-4222-8222-222222222222",
        entityType: "event",
        dedupHash: "a".repeat(64),
        dedupVersion: "v1",
        blockKeys: ["b1", "b2"],
        contentHash: "b".repeat(64),
        sourceRecordId: "rec-1",
        sourceUrl: "https://example.org/1",
        parserVersion: "p1",
        normalizerVersion: "n1",
        rawArtifactId: "33333333-3333-4333-8333-333333333333",
      } as never,
      { scraperId: SCRAPER },
    );

    expect(res).toEqual({ aporteId: "new-id", duplicate: false });
    expect(captured.insert).toMatchObject({
      run_id: "22222222-2222-4222-8222-222222222222",
      entity_type: "event",
      dedup_hash: "a".repeat(64),
      dedup_version: "v1",
      block_keys: ["b1", "b2"],
      content_hash: "b".repeat(64),
      source_record_id: "rec-1",
      source_url: "https://example.org/1",
      parser_version: "p1",
      normalizer_version: "n1",
      raw_artifact_id: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("re-enviar el mismo external_id devuelve duplicate sin insertar", async () => {
    const { client, captured } = makeSupabase({
      // 1) fuente encontrada · 2) duplicado existente
      maybeSingleQueue: [{ data: { id: "src-1" } }, { data: { id: "existing" } }],
    });
    adminMock.mockReturnValue(client as never);

    const res = await createAporte(
      {
        sourceId: "11111111-1111-4111-8111-111111111111",
        externalId: "fp1",
        rawJson: {},
      } as never,
      { scraperId: SCRAPER },
    );

    expect(res).toEqual({ aporteId: "existing", duplicate: true });
    expect(captured.insert).toBeUndefined();
  });

  it("deja en null los campos de dedup ausentes (compat hacia atrás)", async () => {
    const { client, captured } = makeSupabase({
      maybeSingleQueue: [{ data: { id: "src-1" } }, { data: null }],
      singleResult: { data: { id: "new-id" }, error: null },
    });
    adminMock.mockReturnValue(client as never);

    await createAporte(
      {
        sourceId: "11111111-1111-4111-8111-111111111111",
        externalId: "fp2",
        rawText: "hola",
      } as never,
      { scraperId: SCRAPER },
    );

    expect(captured.insert).toMatchObject({
      run_id: null,
      entity_type: null,
      dedup_hash: null,
      block_keys: null,
    });
  });
});
