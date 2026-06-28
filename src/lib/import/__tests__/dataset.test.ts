import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error — núcleo en JS puro (JSDoc), sin tipos .d.ts
import { importDataset, parseCsv } from "../dataset.mjs";

const FIXTURE = readFileSync(
  new URL("./fixtures/paginas-ayuda.csv", import.meta.url),
  "utf8",
);

/** Store en memoria que imita el índice único (scraper_id, external_id). */
function memoryStore(sourceSlug = "paginas-de-ayuda") {
  const byKey = new Map<string, { id: string; rawJson: unknown }>();
  let n = 0;
  return {
    byKey,
    async resolveSource(slug: string) {
      return slug === sourceSlug ? { sourceId: "src-1", ownerId: "scraper-1" } : null;
    },
    async findByExternalId(scraperId: string, ext: string) {
      return byKey.get(`${scraperId}::${ext}`) ?? null;
    },
    async insert(rec: { scraperId: string; externalId: string; rawJson: unknown }) {
      const id = `a-${++n}`;
      byKey.set(`${rec.scraperId}::${rec.externalId}`, { id, rawJson: rec.rawJson });
      return { id };
    },
    async update(id: string, patch: { rawJson: unknown }) {
      for (const v of byKey.values()) if (v.id === id) v.rawJson = patch.rawJson;
    },
  };
}

const req = (over: Record<string, unknown> = {}) => ({
  content: FIXTURE,
  format: "csv" as const,
  sourceSlug: "paginas-de-ayuda",
  ...over,
});

describe("parseCsv", () => {
  it("respeta comillas, comas embebidas y BOM", () => {
    const rows = parseCsv('﻿a,"b,c",d\r\n"x""y",z\n');
    expect(rows).toEqual([
      ["a", "b,c", "d"],
      ['x"y', "z"],
    ]);
  });
});

describe("importDataset (fixture Páginas de ayuda)", () => {
  it("dry-run no escribe y predice estados", async () => {
    const store = memoryStore();
    const r = await importDataset(req({ dryRun: true }), store);
    expect(r.ok).toBe(true);
    expect(r.dryRun).toBe(true);
    expect(r.summary).toEqual({
      processed: 9,
      inserted: 3,
      updated: 0,
      skipped: 3, // 2 no-seleccionadas + 1 duplicado intra-archivo
      rejected: 3, // sin URL, URL inválida, sin nombre
    });
    expect(store.byKey.size).toBe(0); // nada persistido
  });

  it("ejecución real inserta y normaliza", async () => {
    const store = memoryStore();
    const r = await importDataset(req(), store);
    expect(r.summary.inserted).toBe(3);
    expect(store.byKey.size).toBe(3);

    // URL canónica (sin "/" final) como external_id.
    const yummy = store.byKey.get("scraper-1::https://dona.yummyrides.com");
    expect(yummy).toBeTruthy();

    // Normalización: categorías múltiples + slugs, nombre con espacios recortado.
    const bomberos = store.byKey.get("scraper-1::https://donorbox.org/emergency-relief")!
      .rawJson as { categorias: string[]; categorias_slug: string[] };
    expect(bomberos.categorias).toEqual(["Donaciones", "Edificios"]);
    expect(bomberos.categorias_slug).toEqual(["donaciones", "edificios"]);
    const vene = [...store.byKey.values()]
      .map((v) => v.rawJson as { nombre?: string })
      .find((j) => j.nombre === "VeneHelp");
    expect(vene).toBeTruthy();
  });

  it("re-importar el mismo archivo NO duplica (idempotencia)", async () => {
    const store = memoryStore();
    await importDataset(req(), store);
    const r2 = await importDataset(req(), store);
    expect(r2.summary.inserted).toBe(0);
    expect(r2.summary.updated).toBe(0);
    expect(r2.summary.skipped).toBe(6);
    expect(store.byKey.size).toBe(3); // sin filas nuevas
  });

  it("cambios en una fila existente -> updated", async () => {
    const store = memoryStore();
    await importDataset(req(), store);
    const modificado =
      "Nombre,URL,Quién la creó,Para qué existe,Categoría\n" +
      "Dona con Yummy,https://dona.yummyrides.com/,,DESCRIPCION NUEVA,Donaciones\n";
    const r = await importDataset(req({ content: modificado }), store);
    expect(r.summary.updated).toBe(1);
    expect(r.summary.inserted).toBe(0);
  });

  it("errores por fila incluyen motivo y campo", async () => {
    const store = memoryStore();
    const r = await importDataset(req(), store);
    type Row = { status: string; field?: string; reason?: string };
    const rejected = r.rows.filter((x: Row) => x.status === "rejected");
    expect(rejected.map((x: Row) => x.field).sort()).toEqual(["Nombre", "URL", "URL"]);
    expect(rejected.every((x: Row) => typeof x.reason === "string")).toBe(true);
  });

  it("fuente inexistente -> ok:false", async () => {
    const r = await importDataset(req({ sourceSlug: "no-existe" }), memoryStore());
    expect(r.ok).toBe(false);
    expect(r.error).toContain("no existe");
  });

  it("acepta formato JSON", async () => {
    const store = memoryStore();
    const content = JSON.stringify([
      { Nombre: "Ej", URL: "https://ejemplo.org", Categoría: "Mapas, Salud" },
    ]);
    const r = await importDataset(req({ content, format: "json" }), store);
    expect(r.summary.inserted).toBe(1);
  });
});
