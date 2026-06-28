// Importador de datasets tabulares (CSV/JSON) -> tabla `sources`.
//
// Núcleo PURO y sin dependencias: parsea, normaliza, valida y decide el estado de
// cada fila. La persistencia entra por un "store" inyectado (puerto), así el mismo
// código corre en el CLI (store Supabase) y en los tests (store en memoria).
//
// Modelo: cada fila del dataset es una `fuente` (`source`).
//   slug = slugify(Nombre)  ->  idempotencia vía el índice único `sources.slug`.
//   Re-importar el mismo archivo no duplica: filas iguales quedan "skipped",
//   filas con `name`/`website` cambiados quedan "updated".
//
// `sources` es una tabla mínima (name, slug, website, owner_id). Las columnas extra
// del dataset (`Quién la creó`, `Para qué existe`, `Categoría`) NO tienen columna y
// no se persisten. Si en el futuro hacen falta, van en otra tabla (p.ej. `aportes`),
// no aquí. ponytail: import raw de fuentes, sin metadatos hasta que el modelo lo pida.

/**
 * @typedef {Object} ImportRequest
 * @property {string} content            Texto crudo del archivo (CSV o JSON).
 * @property {'csv'|'json'} [format]     Por defecto 'csv'.
 * @property {string} [ownerId]          owner_id de las fuentes creadas (null = del sistema).
 * @property {boolean} [dryRun]          true = no escribe, solo predice estados.
 * @property {boolean} [includeUnselected] true = importa filas con flag FALSE.
 *
 * @typedef {Object} RowReport
 * @property {number} line               Línea (1-based) en el archivo de origen.
 * @property {string|null} name
 * @property {string|null} url
 * @property {string|null} slug
 * @property {'inserted'|'updated'|'skipped'|'rejected'} status
 * @property {string} [reason]
 * @property {string} [field]
 *
 * @typedef {Object} ImportReport
 * @property {boolean} ok
 * @property {boolean} dryRun
 * @property {string} [error]
 * @property {{processed:number, inserted:number, updated:number, skipped:number, rejected:number}} summary
 * @property {RowReport[]} rows
 *
 * Puerto de persistencia:
 * @typedef {Object} Store
 * @property {(slug:string)=>Promise<{id:string, name:string, website:string|null}|null>} findBySlug
 * @property {(rec:{name:string, slug:string, website:string, ownerId:string|null})=>Promise<{id:string}>} insert
 * @property {(id:string, patch:{name:string, website:string})=>Promise<void>} update
 */

const KNOWN = {
  nombre: "nombre",
  url: "url",
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

/** URL canónica: valida, baja host a minúsculas, quita fragmento y "/" final. */
function canonicalUrl(raw) {
  const u = new URL(String(raw).trim()); // lanza si es inválida
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("esquema no http(s)");
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  return u.toString().replace(/\/$/, "");
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

/** Construye el registro normalizado de una fila ya mapeada. Lanza con {field} si inválida. */
function buildRecord(get) {
  const name = cleanText(get("nombre"));
  if (!name) { const e = new Error("Nombre vacío"); e.field = "Nombre"; throw e; }

  const slug = slugify(name);
  if (!slug) { const e = new Error(`Nombre sin caracteres válidos para slug: ${name}`); e.field = "Nombre"; throw e; }

  const rawUrl = cleanText(get("url"));
  if (!rawUrl) { const e = new Error("URL vacía"); e.field = "URL"; throw e; }
  let website;
  try { website = canonicalUrl(rawUrl); }
  catch { const e = new Error(`URL inválida: ${rawUrl}`); e.field = "URL"; throw e; }

  return { slug, name, website };
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
      rows.push({ line, name: cleanText(get("nombre")), url: cleanText(get("url")), slug: null, status: "skipped", reason: "fila no marcada para incluir (flag FALSE)" });
      continue;
    }

    try {
      const rec = buildRecord(get);
      plans.push({ idx: rows.length, rec });
      rows.push({ line, name: rec.name, url: rec.website, slug: rec.slug, status: "inserted" }); // provisional
    } catch (e) {
      rows.push({ line, name: cleanText(get("nombre")), url: cleanText(get("url")), slug: null, status: "rejected", reason: e.message, field: e.field ?? undefined });
    }
  }
  return { rows, plans };
}

/** Lee JSON (array de objetos con claves en español) y lo aplana a tabla [headers,...rows]. */
function jsonToTable(content) {
  const data = JSON.parse(content);
  const arr = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : null;
  if (!arr) throw new Error("El JSON debe ser un array de filas (o {rows:[...]})");
  const headers = ["Nombre", "URL"];
  const pick = (o, names) => { for (const n of names) if (o[n] != null) return o[n]; return ""; };
  const rows = arr.map((o) => [
    pick(o, ["Nombre", "nombre", "name"]),
    pick(o, ["URL", "url", "website"]),
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

  let table;
  try {
    table = (req.format ?? "csv") === "json" ? jsonToTable(req.content) : parseCsv(req.content);
  } catch (e) {
    return { ok: false, dryRun, error: `No se pudo parsear el archivo: ${e.message}`, summary, rows: [] };
  }

  let rows, plans;
  try { ({ rows, plans } = planRows(table, Boolean(req.includeUnselected))); }
  catch (e) { return { ok: false, dryRun, error: e.message, summary, rows: [] }; }

  const ownerId = req.ownerId ?? null;

  // Resuelve insert/update/skip por fila usando el índice único `sources.slug`.
  const seenInRun = new Set(); // mismo slug repetido en el archivo => 1 sola escritura
  for (const { idx, rec } of plans) {
    if (seenInRun.has(rec.slug)) {
      rows[idx].status = "skipped";
      rows[idx].reason = "Nombre duplicado en el archivo (mismo slug)";
      continue;
    }
    seenInRun.add(rec.slug);

    const existing = await store.findBySlug(rec.slug);
    if (!existing) {
      if (!dryRun) await store.insert({ name: rec.name, slug: rec.slug, website: rec.website, ownerId });
      rows[idx].status = "inserted";
    } else if (existing.name === rec.name && existing.website === rec.website) {
      rows[idx].status = "skipped";
      rows[idx].reason = "sin cambios (ya importada)";
    } else {
      if (!dryRun) await store.update(existing.id, { name: rec.name, website: rec.website });
      rows[idx].status = "updated";
    }
  }

  for (const r of rows) { summary.processed++; summary[r.status]++; }
  return { ok: true, dryRun, summary, rows };
}
