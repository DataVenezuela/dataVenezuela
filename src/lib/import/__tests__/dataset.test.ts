import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error — núcleo en JS puro (JSDoc), sin tipos .d.ts
import { importDataset, parseCsv } from "../dataset.mjs";

const FIXTURE = readFileSync(
  new URL("./fixtures/paginas-ayuda.csv", import.meta.url),
  "utf8",
);

/** Store en memoria que imita el índice único `sources.slug`. */
function memoryStore() {
  const bySlug = new Map<string, { id: string; name: string; website: string | null }>();
  let n = 0;
  return {
    bySlug,
    async findBySlug(slug: string) {
      return bySlug.get(slug) ?? null;
    },
    async insert(rec: { name: string; slug: string; website: string }) {
      const id = `s-${++n}`;
      bySlug.set(rec.slug, { id, name: rec.name, website: rec.website });
      return { id };
    },
    async update(id: string, patch: { name: string; website: string }) {
      for (const v of bySlug.values()) if (v.id === id) { v.name = patch.name; v.website = patch.website; }
    },
  };
}

const req = (over: Record<string, unknown> = {}) => ({
  content: FIXTURE,
  format: "csv" as const,
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

describe("importDataset (fixture Páginas de ayuda -> sources)", () => {
  it("dry-run no escribe y predice estados", async () => {
    const store = memoryStore();
    const r = await importDataset(req({ dryRun: true }), store);
    expect(r.ok).toBe(true);
    expect(r.dryRun).toBe(true);
    expect(r.summary).toEqual({
      processed: 9,
      inserted: 3,
      updated: 0,
      skipped: 3, // 2 no-seleccionadas + 1 duplicado intra-archivo (mismo slug)
      rejected: 3, // sin URL, URL inválida, sin nombre
    });
    expect(store.bySlug.size).toBe(0); // nada persistido
  });

  it("ejecución real inserta como fuentes y normaliza", async () => {
    const store = memoryStore();
    const r = await importDataset(req(), store);
    expect(r.summary.inserted).toBe(3);
    expect(store.bySlug.size).toBe(3);

    // slug derivado del Nombre; website canónico (sin "/" final).
    const yummy = store.bySlug.get("dona-con-yummy");
    expect(yummy?.website).toBe("https://dona.yummyrides.com");

    // Nombre con espacios recortado -> slug estable.
    expect(store.bySlug.get("venehelp")?.name).toBe("VeneHelp");
    expect(store.bySlug.get("bomberos-de-la-ucv")).toBeTruthy();
  });

  it("re-importar el mismo archivo NO duplica (idempotencia)", async () => {
    const store = memoryStore();
    await importDataset(req(), store);
    const r2 = await importDataset(req(), store);
    expect(r2.summary.inserted).toBe(0);
    expect(r2.summary.updated).toBe(0);
    expect(r2.summary.skipped).toBe(6);
    expect(store.bySlug.size).toBe(3); // sin filas nuevas
  });

  it("cambios en una fila existente -> updated", async () => {
    const store = memoryStore();
    await importDataset(req(), store);
    const modificado =
      "Nombre,URL\n" +
      "Dona con Yummy,https://dona.yummyrides.com/nueva-landing\n";
    const r = await importDataset(req({ content: modificado }), store);
    expect(r.summary.updated).toBe(1);
    expect(r.summary.inserted).toBe(0);
    expect(store.bySlug.get("dona-con-yummy")?.website).toBe("https://dona.yummyrides.com/nueva-landing");
  });

  it("errores por fila incluyen motivo y campo", async () => {
    const store = memoryStore();
    const r = await importDataset(req(), store);
    type Row = { status: string; field?: string; reason?: string };
    const rejected = r.rows.filter((x: Row) => x.status === "rejected");
    expect(rejected.map((x: Row) => x.field).sort()).toEqual(["Nombre", "URL", "URL"]);
    expect(rejected.every((x: Row) => typeof x.reason === "string")).toBe(true);
  });

  it("acepta formato JSON", async () => {
    const store = memoryStore();
    const content = JSON.stringify([
      { Nombre: "Ej", URL: "https://ejemplo.org" },
    ]);
    const r = await importDataset(req({ content, format: "json" }), store);
    expect(r.summary.inserted).toBe(1);
    expect(store.bySlug.get("ej")?.website).toBe("https://ejemplo.org");
  });
});
