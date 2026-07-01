# Importar datasets (CSV/JSON) — utilidad para agentes de IA

Toma un archivo tabular (p. ej. `Páginas de ayuda - Sheet1.csv`), lo interpreta y lo
sube a la base de datos como **fuentes** (`sources`), con validación, normalización,
idempotencia y reporte por fila.

- Núcleo (puro, testeado): [`src/lib/import/dataset.mjs`](../src/lib/import/dataset.mjs)
- CLI: [`scripts/import-dataset.mjs`](../scripts/import-dataset.mjs) → `npm run import:dataset`
- Test de integración: [`src/lib/import/__tests__/dataset.test.ts`](../src/lib/import/__tests__/dataset.test.ts)

> **Alcance**: este importador escribe SOLO en `sources`. La ingesta de `aportes`
> (datos en bruto) va por `POST /api/aportes`, que además lleva el contrato de staging
> para dedup cross-source (ver [`docs/api-dedup.md`](./api-dedup.md)). Este utilitario
> no escribe en `aportes` para no competir con ese pipeline.

## Modelo de destino

Cada fila → un registro en `sources` (tabla mínima: `name`, `slug`, `website`,
`owner_id`):

| Campo `sources` | Origen |
|---|---|
| `name`     | `Nombre` (trim + colapso de espacios) |
| `slug`     | `slugify(Nombre)` — **clave de deduplicación** (índice único) |
| `website`  | URL canónica de la fila |
| `owner_id` | `ownerId` del request, o `null` (fuente del sistema) |

**Idempotencia**: el índice único `sources.slug` evita duplicados. Re-ejecutar el
mismo archivo no inserta nada nuevo: filas iguales quedan `skipped`, filas con `name`
o `website` cambiados quedan `updated`.

Las columnas extra del dataset (`Quién la creó`, `Para qué existe`, `Categoría`) **no
se persisten**: `sources` no tiene columna para ellas. Si más adelante hacen falta,
van en otra tabla, no aquí.

## Mapeo de columnas

Las columnas se detectan por **nombre de encabezado** (sin acentos, sin distinguir
mayúsculas), no por posición. Una columna inicial de checkbox (`TRUE`/`FALSE`, típica
de Google Sheets) se interpreta como "incluir esta fila".

| Columna CSV | Destino | Normalización |
|---|---|---|
| `Nombre` | `name` + `slug` | trim + colapso de espacios; slug sin acentos. **Requerido**. |
| `URL` | `website` | URL canónica (valida, host a minúsculas, sin fragmento ni `/` final). **Requerido**. |
| _(checkbox)_ | _(filtro)_ | `TRUE`/`x`/`1`/`si` → incluir la fila |

## Contrato de entrada (JSON)

```json
{
  "file": "data/Páginas de ayuda - Sheet1.csv",
  "format": "csv",
  "ownerId": "uuid-opcional",
  "dryRun": true,
  "includeUnselected": false
}
```

| Campo | Req. | Default | Notas |
|---|---|---|---|
| `file` | sí | — | ruta al CSV/JSON |
| `format` | no | `csv` | `csv` \| `json` (`json` = array de objetos con las mismas claves) |
| `ownerId` | no | `null` | `owner_id` de las fuentes creadas (null = del sistema) |
| `dryRun` | no | `false` | no escribe; predice estados leyendo la BD |
| `includeUnselected` | no | `false` | importa también filas con flag `FALSE` |

## Contrato de salida (JSON)

```json
{
  "ok": true,
  "dryRun": true,
  "summary": { "processed": 982, "inserted": 22, "updated": 0, "skipped": 960, "rejected": 0 },
  "rows": [
    { "line": 4, "name": "Bomberos de la UCV", "url": "https://donorbox.org/...", "slug": "bomberos-de-la-ucv", "status": "inserted" },
    { "line": 7, "name": "Sin URL", "url": null, "slug": null, "status": "rejected", "reason": "URL vacía", "field": "URL" }
  ]
}
```

Estados por fila: `inserted` · `updated` · `skipped` (no seleccionada, duplicada o sin
cambios) · `rejected` (incluye `reason` y `field`). Si falla algo global (archivo
ilegible, sin encabezado válido), `ok=false` con `error`.

## Uso

```bash
# dry-run (no escribe)
echo '{"file":"data/paginas.csv","dryRun":true}' \
  | npm run import:dataset

# ejecución real desde un request en archivo
npm run import:dataset -- request.json
```

El reporte JSON sale por **stdout**; un resumen humano por **stderr**. Código de salida
`1` si `ok=false`. Requiere `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
(se cargan con `--env-file=.env.local`).
