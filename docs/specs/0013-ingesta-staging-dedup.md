# SPEC-0013 — Ingesta de staging para dedup cross-source (aportes + watermarks)

| Campo | Valor |
|---|---|
| Estado | propuesto |
| Depende de | Migración (este spec) · VZLA_DEDUP `staging_exporter` (otro repo) |
| ADR / motivacion | `adr/0001` (serving) · esquema dedup `0004` |
| PR | — |

## Contexto

El pipeline de VZLA_DEDUP deja de escribir JSONL en disco: ahora su destino final
es la tabla `aportes` de dataVenezuela vía `POST /api/aportes`. Para que la dedup
pueda hacerse **entre fuentes** (no solo dentro de una), el exporter necesita
mandar las claves de dedup (`dedup_hash`, `block_keys`, …) junto al registro, y
necesita un **watermark por fuente** para no re-procesar lo ya enviado. Hoy ni la
tabla `aportes` tiene esas columnas, ni existe `source_watermarks`, ni el endpoint
de ingesta acepta esos campos. Este spec construye **el lado dataVenezuela** que
desbloquea ese exporter.

## Alcance (cabe en 1 PR)

Spec umbrella: un solo PR que entrega la migración + los cambios de API que el
exporter necesita para funcionar de extremo a extremo. Es deliberadamente más
grande que un spec típico; si en review resulta inmanejable, partir extrayendo la
migración a su propio PR previo.

- **Migración** — nuevas columnas en `aportes`, sus índices, y la tabla
  `source_watermarks` con su RLS + grants (patrón de `0004`/`0005`/`0006`).
- **`POST /api/aportes`** — aceptar y persistir los campos de dedup que envía el
  `staging_exporter`. La idempotencia por `(scraper_id, external_id)` ya existe y
  no cambia.
- **Endpoint de watermarks** — leer el watermark de una fuente al inicio de cada
  corrida y actualizarlo cuando el batch termina OK.
- **Tipos y docs** — regenerar `src/lib/database.types.ts` y documentar el
  contrato extendido en `docs/api-dedup.md` (o doc equivalente).

## Contrato / Interfaz

### 1. Migración

Columnas nuevas en `public.aportes` (todas nullable; las llena el exporter salvo
`consolidated_at`, que la pondrá el proceso de consolidación, fuera de este spec):

```sql
ALTER TABLE public.aportes
  ADD COLUMN run_id             uuid,
  ADD COLUMN entity_type        text,
  ADD COLUMN dedup_hash         varchar(64),
  ADD COLUMN dedup_version      text,
  ADD COLUMN block_keys         text[],
  ADD COLUMN content_hash       varchar(64),
  ADD COLUMN consolidated_at    timestamptz,
  ADD COLUMN source_record_id   text,
  ADD COLUMN source_url         text,
  ADD COLUMN parser_version     text,
  ADD COLUMN normalizer_version text,
  ADD COLUMN raw_artifact_id    uuid;

CREATE INDEX aportes_pending_idx
  ON public.aportes (entity_type) WHERE consolidated_at IS NULL;
CREATE INDEX aportes_block_keys_idx
  ON public.aportes USING gin (block_keys);
CREATE INDEX aportes_run_id_idx
  ON public.aportes (run_id);

CREATE TABLE public.source_watermarks (
  source_slug  text PRIMARY KEY
               REFERENCES public.sources(slug) ON DELETE CASCADE,
  watermark_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

`source_watermarks` lleva RLS + grants propios (no se auto-exponen): `service_role`
acceso total; el scraper dueño de la fuente puede leer/escribir su fila (vía route
handler con `service_role`, validando ownership en la API como hace
`createAporte`). Trigger `set_updated_at` reutilizado de `0001`.

### 2. `POST /api/aportes` (contrato extendido)

`aporteInputSchema` acepta, además de lo actual, estos campos opcionales que se
persisten 1:1 en las columnas nuevas:

| Body (camelCase) | Columna | Tipo |
|---|---|---|
| `runId` | `run_id` | uuid |
| `entityType` | `entity_type` | text (`event` \| `acopio` \| `person`) |
| `dedupHash` | `dedup_hash` | hex ≤64 |
| `dedupVersion` | `dedup_version` | text |
| `blockKeys` | `block_keys` | string[] |
| `contentHash` | `content_hash` | hex ≤64 |
| `sourceRecordId` | `source_record_id` | text |
| `sourceUrl` | `source_url` | URL |
| `parserVersion` | `parser_version` | text |
| `normalizerVersion` | `normalizer_version` | text |
| `rawArtifactId` | `raw_artifact_id` | uuid |

El `external_id` sigue siendo la clave de idempotencia (el exporter lo deriva del
fingerprint / `deterministic_id`). Respuesta sin cambios: `201` nuevo / `200`
duplicado. `GET /api/aportes` mantiene sus `PUBLIC_COLUMNS` (las columnas de dedup
son internas, no se exponen en lectura pública).

### 3. Endpoint de watermarks

Auth `x-api-key` (scraper). Valida que la fuente pertenezca al scraper (mismo
patrón que `SourceOwnershipError`); fuente ajena/inexistente → `403`.

- `GET /api/source-watermarks/{slug}` → `200 { "sourceSlug": "...", "watermarkAt": "<ISO>" }`.
  Si la fuente existe pero no tiene fila, devuelve el default `1970-01-01T00:00:00Z`.
- `PUT /api/source-watermarks/{slug}` con body `{ "watermarkAt": "<ISO>" }` →
  upsert de la fila; `200` con el valor guardado. Body inválido → `422`.

## Criterios de aceptacion

- [ ] Aplicar la migración crea las 12 columnas en `aportes`, los 3 índices y la
      tabla `source_watermarks`; `supabase db reset` corre limpio.
- [ ] `POST /api/aportes` con todos los campos de dedup persiste cada uno en su
      columna; re-enviar el mismo `external_id` del mismo scraper devuelve `200`
      `duplicate` y no inserta una segunda fila.
- [ ] `POST /api/aportes` sin los campos nuevos sigue funcionando igual que hoy
      (compatibilidad hacia atrás).
- [ ] `GET /api/source-watermarks/{slug}` de una fuente propia sin fila devuelve
      el default `1970-01-01T00:00:00Z`; de una fuente ajena devuelve `403`.
- [ ] `PUT /api/source-watermarks/{slug}` con un ISO válido hace upsert y la
      siguiente lectura lo refleja; `updated_at` cambia.
- [ ] `src/lib/database.types.ts` regenerado incluye las columnas y la tabla.
- [ ] `docs/api-dedup.md` (o doc del contrato) documenta los campos nuevos de
      `POST /api/aportes` y el endpoint de watermarks.
- [ ] Tests verdes (`npm test`); ningún test hace red real (mock del cliente
      Supabase, patrón existente en `src/lib/dedup/__tests__`).

## Fuera de alcance

- Todo el lado VZLA_DEDUP: `scrapers/dedup/specs.py`, `fingerprint.py`,
  `staging_exporter.py`, wiring de `run_pipeline.py` y borrado de código muerto.
  Vive en el repo del pipeline, no aquí.
- **Consolidación**: leer `aportes` pendientes (`consolidated_at IS NULL`),
  agrupar por `block_keys`/`dedup_hash` y materializar en las 6 tablas
  normalizadas. `consolidated_at` se añade aquí pero nadie la escribe todavía;
  va en un spec aparte.
- Exponer las columnas de dedup en la lectura pública de `aportes`.

## Dependencias

- **Migración** (este spec) — bloquea al `staging_exporter` de VZLA_DEDUP, que no
  puede testearse contra un entorno real hasta que existan las columnas y
  `source_watermarks`.
- Issue 1 de VZLA_DEDUP (model fixes: `Person.event_id`, `AcopioCenter.status`)
  es prerequisito del exporter, no de este spec.

## Verificacion

```bash
# 1. Migración local
supabase db reset           # corre 0001..00NN sin error
# inspeccionar columnas/tabla nuevas
psql "$DATABASE_URL" -c '\d public.aportes'
psql "$DATABASE_URL" -c '\d public.source_watermarks'

# 2. Tests (unit + contrato, sin red real)
npm test

# 3. Smoke manual con dev local (PORT=3100, ver memoria de puertos)
#    a) ingesta con campos de dedup
curl -X POST http://localhost:3100/api/aportes \
  -H "x-api-key: $KEY" -H "content-type: application/json" \
  -d '{"sourceSlug":"funvisis","externalId":"<fingerprint>","entityType":"event",
       "dedupHash":"<64hex>","dedupVersion":"v1","blockKeys":["..."],
       "rawJson":{"...":"..."}}'      # 201; repetir => 200 duplicate
#    b) watermark
curl http://localhost:3100/api/source-watermarks/funvisis -H "x-api-key: $KEY"
curl -X PUT http://localhost:3100/api/source-watermarks/funvisis \
  -H "x-api-key: $KEY" -H "content-type: application/json" \
  -d '{"watermarkAt":"2026-06-28T00:00:00Z"}'
```
