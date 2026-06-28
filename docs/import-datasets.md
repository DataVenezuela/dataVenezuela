# Importar datasets (CSV/JSON) — utilidad para agentes de IA

Toma un archivo tabular (p. ej. `Páginas de ayuda - Sheet1.csv`), lo interpreta y lo
sube a la base de datos como **aportes** atribuidos a una **fuente** (`source`), con
validación, normalización, idempotencia y reporte por fila.

- Núcleo (puro, testeado): [`src/lib/import/dataset.mjs`](../src/lib/import/dataset.mjs)
- CLI: [`scripts/import-dataset.mjs`](../scripts/import-dataset.mjs) → `npm run import:dataset`
- Test de integración: [`src/lib/import/__tests__/dataset.test.ts`](../src/lib/import/__tests__/dataset.test.ts)

## Modelo de destino

Cada fila → un registro en `aportes`:

| Campo `aportes` | Origen |
|---|---|
| `external_id` | URL canónica de la fila (clave de deduplicación) |
| `raw_json`    | objeto normalizado (ver abajo) |
| `raw_text`    | `Nombre` (respeta `aportes_has_payload`) |
| `source_id`   | la fuente resuelta por `sourceSlug` |
| `scraper_id`  | `scraperId` del request, o `source.owner_id` |

**Idempotencia**: el índice único `(scraper_id, external_id)` de `aportes` evita
duplicados. Re-ejecutar el mismo archivo no inserta nada nuevo: filas iguales quedan
`skipped`, filas con datos cambiados quedan `updated`.

## Mapeo de columnas

Las columnas se detectan por **nombre de encabezado** (sin acentos, sin distinguir
mayúsculas), no por posición. Una columna inicial de checkbox (`TRUE`/`FALSE`, típica
de Google Sheets) se interpreta como "incluir esta fila".

| Columna CSV | Clave en `raw_json` | Normalización |
|---|---|---|
| `Nombre` | `nombre` | trim + colapso de espacios. **Requerido**. |
| `URL` | `url` | URL canónica (valida, host a minúsculas, sin fragmento ni `/` final). **Requerido**. |
| `Quién la creó` | `quien_la_creo` | trim; vacío → `null` |
| `Para qué existe` | `para_que_existe` | trim; vacío → `null` |
| `Categoría` | `categorias` + `categorias_slug` | separa por `,`/`;`, dedup; slugs sin acentos |
| _(checkbox)_ | `seleccionada` | `TRUE`/`x`/`1`/`si` → seleccionada |

> **Categorías**: por ahora solo se normaliza a lista de strings + slugs. El mapeo a una
> taxonomía fija queda **pendiente** del ticket de modelo de categorías.

## Contrato de entrada (JSON)

```json
{
  "file": "data/Páginas de ayuda - Sheet1.csv",
  "format": "csv",
  "sourceSlug": "paginas-de-ayuda",
  "scraperId": "uuid-opcional",
  "dryRun": true,
  "includeUnselected": false
}
```

| Campo | Req. | Default | Notas |
|---|---|---|---|
| `file` | sí | — | ruta al CSV/JSON |
| `format` | no | `csv` | `csv` \| `json` (`json` = array de objetos con las mismas claves) |
| `sourceSlug` | sí | — | la fuente destino debe existir |
| `scraperId` | no | `source.owner_id` | requerido si la fuente no tiene owner |
| `dryRun` | no | `false` | no escribe; predice estados leyendo la BD |
| `includeUnselected` | no | `false` | importa también filas con flag `FALSE` |

## Contrato de salida (JSON)

```json
{
  "ok": true,
  "dryRun": true,
  "source": { "slug": "paginas-de-ayuda", "sourceId": "...", "scraperId": "..." },
  "summary": { "processed": 982, "inserted": 22, "updated": 0, "skipped": 960, "rejected": 0 },
  "rows": [
    { "line": 4, "name": "Bomberos de la UCV", "url": "https://donorbox.org/...", "externalId": "https://donorbox.org/...", "status": "inserted" },
    { "line": 7, "name": "Sin URL", "url": null, "externalId": null, "status": "rejected", "reason": "URL vacía", "field": "URL" }
  ]
}
```

Estados por fila: `inserted` · `updated` · `skipped` (no seleccionada, duplicada o sin
cambios) · `rejected` (incluye `reason` y `field`). Si falla algo global (archivo
ilegible, fuente inexistente), `ok=false` con `error`.

## Uso

```bash
# dry-run (no escribe)
echo '{"file":"data/paginas.csv","sourceSlug":"paginas-de-ayuda","dryRun":true}' \
  | npm run import:dataset

# ejecución real desde un request en archivo
npm run import:dataset -- request.json
```

El reporte JSON sale por **stdout**; un resumen humano por **stderr**. Código de salida
`1` si `ok=false`. Requiere `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
(se cargan con `--env-file=.env.local`).
