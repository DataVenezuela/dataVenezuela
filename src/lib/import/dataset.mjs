// Importador de datasets tabulares (CSV/JSON) -> tabla `aportes`.
//
// Núcleo PURO y sin dependencias: parsea, normaliza, valida y decide el estado de
// cada fila. La persistencia entra por un "store" inyectado (puerto), así el mismo
// código corre en el CLI (store Supabase) y en los tests (store en memoria).
//
// Modelo: cada fila del dataset es un `aporte` atribuido a UNA fuente (`source`).
//   external_id = URL canónica  ->  idempotencia gratis vía el índice único
//   (scraper_id, external_id) de `aportes`. Re-importar el mismo archivo no
//   duplica: filas iguales quedan "skipped", filas cambiadas "updated".
//
// El mapeo de `Categoría` a una taxonomía fija queda PENDIENTE (issue del modelo de
// categorías). Aquí solo normalizamos a lista de strings + slugs.

/**
 * @typedef {Object} ImportRequest
 * @property {string} content            Texto crudo del archivo (CSV o JSON).
 * @property {'csv'|'json'} [format]     Por defecto 'csv'.
 * @property {string} sourceSlug         Slug de la fuente destino (debe existir).
 * @property {string} [scraperId]        Override del scraper_id; si no, usa source.owner_id.
 * @property {boolean} [dryRun]          true = no escribe, solo predice estados.
 * @property {boolean} [includeUnselected] true = importa filas con flag FALSE.
 *
 * @typedef {Object} RowReport
 * @property {number} line               Línea (1-based) en el archivo de origen.
 * @property {string|null} name
 * @property {string|null} url
 * @property {string|null} externalId
 * @property {'inserted'|'updated'|'skipped'|'rejected'} status
 * @property {string} [reason]
 * @property {string} [field]
 *
 * @typedef {Object} ImportReport
 * @property {boolean} ok
 * @property {boolean} dryRun
 * @property {string} [error]
 * @property {{slug:string, sourceId:string, scraperId:string}} [source]
 * @property {{processed:number, inserted:number, updated:number, skipped:number, rejected:number}} summary
 * @property {RowReport[]} rows
 *
 * Puerto de persistencia:
 * @typedef {Object} Store
 * @property {(slug:string)=>Promise<{sourceId:string, ownerId:string|null}|null>} resolveSource
 * @property {(scraperId:string, externalId:string)=>Promise<{id:string, rawJson:unknown}|null>} findByExternalId
 * @property {(rec:{externalId:string, rawJson:unknown, rawText:string, sourceId:string, scraperId:string})=>Promise<{id:string}>} insert
 * @property {(id:string, patch:{rawJson:unknown, rawText:string})=>Promise<void>} update
 */

const KNOWN = {
  nombre: "nombre",
  url: "url",
  "quien la creo": "quien",
  "para que existe": "paraque",
  categoria: "categoria",
  categorias: "categoria",
};

/** Normaliza un encabezado para emparejarlo con las columnas conocidas. */
function normHeader(h) {
  return stripAccents(String(h ?? "").trim().toLowerCase()).replace(/\s+/g, " ");
}

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** slug estable (igual criterio que src/lib/slug.ts). */
function slugify(value) {
  return stripAccents(String(value))
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Colapsa espacios y recorta; "" -> null. */
function cleanText(v) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

/** URL canónica para dedup: valida, baja host a minúsculas, quita fragmento y "/" final. */
function canonicalUrl(raw) {
  const u = new URL(String(raw).trim()); // lanza si es inválida
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("esquema no http(s)");
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  return u.toString().replace(/\/$/, "");
}

/** "Donaciones, Edificios; Salud" -> ["Donaciones","Edificios","Salud"] (sin duplicados). */
function parseCategorias(v) {
  const out = [];
  for (const part of String(v ?? "").split(/[,;]/)) {
    const c = cleanText(part);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/** RFC-4180 mínimo: comillas, comillas escapadas (""), saltos embebidos, CRLF, BOM. */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* ignora; el \n cierra la fila */ }
    else if (c === "\n") { row.push(field); rows.push(row); field = ""; row = []; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Localiza la fila de encabezado (la que tiene Nombre y URL) y mapea columnas. */
function buildColumnMap(headerCells) {
  /** @type {Record<string, number>} */
  const map = {};
  let flagCol = -1;
  headerCells.forEach((cell, idx) => {
    const key = KNOWN[normHeader(cell)];
    if (key && map[key] === undefined) map[key] = idx;
    else if (flagCol === -1 && map.nombre === undefined) flagCol = idx; // col previa a las conocidas
  });
  return { map, flagCol };
}

/** Construye el payload normalizado de una fila ya mapeada. Lanza con {field} si inválida. */
function buildRecord(get) {
  const nombre = cleanText(get("nombre"));
  if (!nombre) { const e = new Error("Nombre vacío"); e.field = "Nombre"; throw e; }

  const rawUrl = cleanText(get("url"));
  if (!rawUrl) { const e = new Error("URL vacía"); e.field = "URL"; throw e; }
  let externalId;
  try { externalId = canonicalUrl(rawUrl); }
  catch { const e = new Error(`URL inválida: ${rawUrl}`); e.field = "URL"; throw e; }

  const categorias = parseCategorias(get("categoria"));
  const rawJson = {
    nombre,
    url: externalId,
    quien_la_creo: cleanText(get("quien")),
    para_que_existe: cleanText(get("paraque")),
    categorias,
    categorias_slug: categorias.map(slugify),
  };
  return { externalId, rawJson, rawText: nombre, name: nombre, url: externalId };
}

function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
}

const SELECTED = new Set(["true", "si", "sí", "x", "1", "yes"]);

/**
 * Convierte filas crudas (CSV/JSON) en un plan de filas con estado previsto.
 * @returns {{rows: RowReport[], plans: Array<{idx:number, rec:any}>}}
 */
function planRows(table, includeUnselected) {
  // Localiza encabezado: primera fila que contenga Nombre y URL.
  let headerIdx = -1;
  for (let i = 0; i < table.length; i++) {
    const norm = table[i].map(normHeader);
    if (norm.includes("nombre") && norm.includes("url")) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error("No se encontró encabezado con columnas 'Nombre' y 'URL'");

  const { map, flagCol } = buildColumnMap(table[headerIdx]);
  /** @type {RowReport[]} */
  const rows = [];
  const plans = [];

  for (let i = headerIdx + 1; i < table.length; i++) {
    const cells = table[i];
    if (cells.every((c) => cleanText(c) === null)) continue; // fila vacía de relleno
    const line = i + 1; // 1-based como en un editor
    const get = (k) => (map[k] !== undefined ? cells[map[k]] : "");

    const flag = flagCol >= 0 ? String(cells[flagCol] ?? "").trim().toLowerCase() : "";
    const selected = flagCol < 0 ? true : SELECTED.has(flag);
    if (!selected && !includeUnselected) {
      rows.push({ line, name: cleanText(get("nombre")), url: cleanText(get("url")), externalId: null, status: "skipped", reason: "fila no marcada para incluir (flag FALSE)" });
      continue;
    }

    try {
      const rec = buildRecord(get);
      rec.rawJson.seleccionada = selected;
      plans.push({ idx: rows.length, rec });
      rows.push({ line, name: rec.name, url: rec.url, externalId: rec.externalId, status: "inserted" }); // provisional
    } catch (e) {
      rows.push({ line, name: cleanText(get("nombre")), url: cleanText(get("url")), externalId: null, status: "rejected", reason: e.message, field: e.field ?? undefined });
    }
  }
  return { rows, plans };
}

/** Lee JSON (array de objetos con claves en español) y lo aplana a tabla [headers,...rows]. */
function jsonToTable(content) {
  const data = JSON.parse(content);
  const arr = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : null;
  if (!arr) throw new Error("El JSON debe ser un array de filas (o {rows:[...]})");
  const headers = ["Nombre", "URL", "Quién la creó", "Para qué existe", "Categoría"];
  const pick = (o, names) => { for (const n of names) if (o[n] != null) return o[n]; return ""; };
  const rows = arr.map((o) => [
    pick(o, ["Nombre", "nombre", "name"]),
    pick(o, ["URL", "url"]),
    pick(o, ["Quién la creó", "quien_la_creo", "quien"]),
    pick(o, ["Para qué existe", "para_que_existe", "paraque", "descripcion"]),
    pick(o, ["Categoría", "categoria", "categorias"]),
  ]);
  return [headers, ...rows];
}

/**
 * Punto de entrada del importador.
 * @param {ImportRequest} req
 * @param {Store} store
 * @returns {Promise<ImportReport>}
 */
export async function importDataset(req, store) {
  const dryRun = Boolean(req.dryRun);
  const summary = { processed: 0, inserted: 0, updated: 0, skipped: 0, rejected: 0 };

  if (!req.sourceSlug) {
    return { ok: false, dryRun, error: "Falta sourceSlug", summary, rows: [] };
  }

  let table;
  try {
    table = (req.format ?? "csv") === "json" ? jsonToTable(req.content) : parseCsv(req.content);
  } catch (e) {
    return { ok: false, dryRun, error: `No se pudo parsear el archivo: ${e.message}`, summary, rows: [] };
  }

  let rows, plans;
  try { ({ rows, plans } = planRows(table, Boolean(req.includeUnselected))); }
  catch (e) { return { ok: false, dryRun, error: e.message, summary, rows: [] }; }

  const src = await store.resolveSource(req.sourceSlug);
  if (!src) {
    return { ok: false, dryRun, error: `La fuente '${req.sourceSlug}' no existe`, summary, rows: [] };
  }
  const scraperId = req.scraperId ?? src.ownerId;
  if (!scraperId) {
    return {
      ok: false, dryRun,
      error: `La fuente '${req.sourceSlug}' no tiene owner_id; pásalo en scraperId para poder deduplicar`,
      summary, rows: [],
    };
  }

  // Resuelve insert/update/skip por fila usando el índice (scraper_id, external_id).
  const seenInRun = new Set(); // mismo external_id repetido en el archivo => 1 sola escritura
  for (const { idx, rec } of plans) {
    if (seenInRun.has(rec.externalId)) {
      rows[idx].status = "skipped";
      rows[idx].reason = "URL duplicada en el archivo";
      continue;
    }
    seenInRun.add(rec.externalId);

    const existing = await store.findByExternalId(scraperId, rec.externalId);
    if (!existing) {
      if (!dryRun) await store.insert({ ...rec, sourceId: src.sourceId, scraperId });
      rows[idx].status = "inserted";
    } else if (stableStringify(existing.rawJson) === stableStringify(rec.rawJson)) {
      rows[idx].status = "skipped";
      rows[idx].reason = "sin cambios (ya importada)";
    } else {
      if (!dryRun) await store.update(existing.id, { rawJson: rec.rawJson, rawText: rec.rawText });
      rows[idx].status = "updated";
    }
  }

  for (const r of rows) { summary.processed++; summary[r.status]++; }
  return { ok: true, dryRun, source: { slug: req.sourceSlug, sourceId: src.sourceId, scraperId }, summary, rows };
}
