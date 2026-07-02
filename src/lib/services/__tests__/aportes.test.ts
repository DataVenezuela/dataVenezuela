import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock del cliente service-role: evita tocar Supabase / red. Cada test inyecta las
// respuestas de las llamadas terminales (.maybeSingle / .single) y captura el insert.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { createAporte, createAportesBulk } from "@/lib/services/aportes";

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

// ---------------------------------------------------------------------------
// createAportesBulk
// ---------------------------------------------------------------------------

type FromHandler = Record<string, unknown>;

function selectBuilder(data: unknown): FromHandler {
  const b: FromHandler = {};
  b.select = () => b;
  b.eq = () => b;
  b.in = () => Promise.resolve({ data });
  return b;
}

function insertBuilder(
  error: { code?: string; message: string } | null,
  captured: { rows?: unknown },
): FromHandler {
  return {
    insert: (rows: unknown) => {
      captured.rows = rows;
      return Promise.resolve({ error });
    },
  };
}

function makeSupabaseBulk(handlers: FromHandler[]) {
  const queue = [...handlers];
  return { from: () => queue.shift()! };
}

const SOURCE_UUID = "11111111-1111-4111-8111-111111111111";
const SRC = { id: SOURCE_UUID, slug: "src-slug" };
const SCRAPER_ID = "scraper-bulk";
// Aporte base válido para reutilizar en pruebas bulk.
const BASE_INPUT = {
  sourceId: SOURCE_UUID,
  rawJson: { a: 1 } as unknown,
} as import("@/lib/validation").AporteInput;

describe("createAportesBulk", () => {
  beforeEach(() => adminMock.mockReset());

  it("inserta en batch y devuelve sent=N cuando no hay duplicados", async () => {
    const captured: { rows?: unknown } = {};
    adminMock.mockReturnValue(
      makeSupabaseBulk([
        selectBuilder([SRC]),            // sources por id
        selectBuilder([]),               // dedup check (ninguno existe)
        insertBuilder(null, captured),   // batch insert
      ]) as never,
    );

    const res = await createAportesBulk(
      [
        { ...BASE_INPUT, externalId: "ext-1" },
        { ...BASE_INPUT, externalId: "ext-2" },
      ],
      { scraperId: SCRAPER_ID },
    );

    expect(res).toEqual({ sent: 2, duplicates: 0, errors: [] });
    expect(Array.isArray(captured.rows)).toBe(true);
    expect((captured.rows as unknown[]).length).toBe(2);
  });

  it("cuenta duplicados sin insertarlos", async () => {
    const captured: { rows?: unknown } = {};
    adminMock.mockReturnValue(
      makeSupabaseBulk([
        selectBuilder([SRC]),
        selectBuilder([{ external_id: "ext-1" }]), // ext-1 ya existe
        insertBuilder(null, captured),
      ]) as never,
    );

    const res = await createAportesBulk(
      [
        { ...BASE_INPUT, externalId: "ext-1" }, // duplicado
        { ...BASE_INPUT, externalId: "ext-2" }, // nuevo
      ],
      { scraperId: SCRAPER_ID },
    );

    expect(res).toEqual({ sent: 1, duplicates: 1, errors: [] });
    expect((captured.rows as unknown[]).length).toBe(1);
  });

  it("agrega error por ítem cuando la fuente no es del scraper", async () => {
    adminMock.mockReturnValue(
      makeSupabaseBulk([
        selectBuilder([]),  // ninguna fuente encontrada
      ]) as never,
    );

    const res = await createAportesBulk(
      [{ ...BASE_INPUT, externalId: "ext-1" }],
      { scraperId: SCRAPER_ID },
    );

    expect(res.sent).toBe(0);
    expect(res.duplicates).toBe(0);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toContain("[0]");
  });

  it("ítems sin externalId se insertan siempre (sin dedup check)", async () => {
    const captured: { rows?: unknown } = {};
    adminMock.mockReturnValue(
      makeSupabaseBulk([
        selectBuilder([SRC]),          // sources
        // NO hay dedup check porque no hay externalIds
        insertBuilder(null, captured), // batch insert directo
      ]) as never,
    );

    const res = await createAportesBulk(
      [
        { ...BASE_INPUT },  // sin externalId
        { ...BASE_INPUT },
      ],
      { scraperId: SCRAPER_ID },
    );

    expect(res).toEqual({ sent: 2, duplicates: 0, errors: [] });
  });

  it("en race 23505 reintenta ítem a ítem y cuenta correctamente", async () => {
    // Primer insert batch falla con 23505; retry individual: 1 ok, 1 duplicado.
    let insertCallCount = 0;
    const retryBuilder: FromHandler = {
      insert: () => {
        insertCallCount++;
        const error =
          insertCallCount === 1
            ? null                                  // primer ítem: ok
            : { code: "23505", message: "unique" }; // segundo: duplicado tardío
        return Promise.resolve({ error });
      },
    };

    adminMock.mockReturnValue(
      makeSupabaseBulk([
        selectBuilder([SRC]),
        selectBuilder([]),  // dedup check: nada existe aún
        // batch insert falla
        {
          insert: () =>
            Promise.resolve({ error: { code: "23505", message: "unique violation" } }),
        },
        retryBuilder,  // retry ítem 1
        retryBuilder,  // retry ítem 2
      ]) as never,
    );

    const res = await createAportesBulk(
      [
        { ...BASE_INPUT, externalId: "ext-1" },
        { ...BASE_INPUT, externalId: "ext-2" },
      ],
      { scraperId: SCRAPER_ID },
    );

    expect(res.sent).toBe(1);
    expect(res.duplicates).toBe(1);
    expect(res.errors).toHaveLength(0);
  });

  it("retorna vacío inmediatamente con array de entrada vacío", async () => {
    const res = await createAportesBulk([], { scraperId: SCRAPER_ID });
    expect(res).toEqual({ sent: 0, duplicates: 0, errors: [] });
    expect(adminMock).not.toHaveBeenCalled();
  });
});
