---
name: import-dataset
description: >-
  Importa archivos tabulares (CSV o JSON, p. ej. exportaciones de Google Sheets como
  "Páginas de ayuda - Sheet1.csv") a la tabla `aportes` de la base de datos del proyecto
  data-venezuela, con validación, normalización, idempotencia y reporte por fila. Úsalo
  SIEMPRE que el usuario quiera subir, ingestar, cargar o importar un dataset/planilla/CSV
  a la base de datos — aunque no diga "aporte" ni "fuente" — y especialmente si menciona
  columnas como Nombre/URL/Categoría, un archivo de "páginas de ayuda", o un export de
  Sheets. NO lo uses para leer o analizar un CSV sin subirlo, ni para datasets que no van
  a esta base (p. ej. `puntos_ayuda_live_db.csv`, que tiene otro esquema).
---

# Importar datasets a `aportes`

Envuelve el CLI `npm run import:dataset`. Cada fila del archivo se convierte en un
registro de `aportes` atribuido a una **fuente** (`source`). La idempotencia es gratis:
el índice único `(scraper_id, external_id)` de `aportes` evita duplicados, usando la URL
canónica de cada fila como `external_id`.

**Contrato completo y tabla de mapeo de columnas:** lee `docs/import-datasets.md`. El
núcleo (parser, normalización, validación) vive en `src/lib/import/dataset.mjs` y el CLI
en `scripts/import-dataset.mjs`.

## Antes de empezar

El CLI escribe en Supabase con la service-role key. Necesita en `.env.local`:
`NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. La **fuente destino** debe
existir ya (su `slug`); si no sabes cuál, pregunta al usuario o lístalas. Si la fuente no
tiene `owner_id`, hace falta pasar `scraperId` (sin él, el índice parcial no deduplica).

## Flujo

Trabaja siempre en este orden — el dry-run primero evita escribir basura en producción:

1. **Arma el request JSON** con los datos que dé el usuario (mínimo `file` + `sourceSlug`):

   ```json
   {
     "file": "data/Páginas de ayuda - Sheet1.csv",
     "format": "csv",
     "sourceSlug": "paginas-de-ayuda",
     "dryRun": true
   }
   ```

   Guárdalo en un archivo (p. ej. `/tmp/import-request.json`). Campos opcionales:
   `format` (`csv` def. | `json`), `scraperId`, `includeUnselected` (importar también
   filas con el checkbox `FALSE`).

2. **Corre el dry-run** y revisa el reporte antes de tocar nada:

   ```bash
   npm run import:dataset -- /tmp/import-request.json
   ```

   El reporte JSON sale por stdout; un resumen humano por stderr. Verifica que
   `inserted`/`updated` tengan sentido y que `rejected` no esconda un problema de
   formato (una columna mal nombrada manda todo a rechazo).

3. **Presenta el resumen al usuario** (procesadas, insertadas, actualizadas, omitidas,
   rechazadas) y, si hay rechazos, las primeras filas con su `reason`/`field`. Confirma
   antes de escribir.

4. **Corre el modo real** quitando `dryRun` (o poniéndolo en `false`) y vuelve a
   ejecutar. Re-ejecutar el mismo archivo es seguro: no duplica.

## Cómo leer la salida

```json
{
  "ok": true,
  "dryRun": true,
  "summary": { "processed": 982, "inserted": 22, "updated": 0, "skipped": 960, "rejected": 0 },
  "rows": [
    { "line": 7, "status": "rejected", "reason": "URL vacía", "field": "URL" }
  ]
}
```

- `inserted` / `updated` — fila nueva / fila existente con datos cambiados.
- `skipped` — no seleccionada (checkbox FALSE), duplicada en el archivo, o sin cambios.
- `rejected` — incluye `reason` y `field` (Nombre o URL faltante/ inválida).
- `ok: false` con `error` — fallo global (archivo ilegible, fuente inexistente). El CLI
  sale con código 1; léelo y arréglalo antes de reintentar.

## Notas

- **Categorías**: por ahora solo se normalizan a `categorias` (lista) + `categorias_slug`.
  El mapeo a una taxonomía fija está pendiente del ticket de modelo de categorías; no
  inventes categorías canónicas.
- Si el usuario pasa un JSON en vez de CSV, debe ser un array de objetos con las mismas
  claves (`Nombre`, `URL`, …); pon `"format": "json"`.
