# SPEC-0015 — Quarantine DB (registros no procesables)

| Campo | Valor |
|---|---|
| Estado | en curso |
| Depende de | 0013 (staging comparte `run_id`) |
| ADR / motivacion | VZLA_DEDUP issue #88 |
| PR | <numero cuando exista> |

## Contexto

Cuando el pipeline de VZLA_DEDUP no puede procesar un registro (parser ausente,
schema invalido, PII no redactable, etc.) hoy lo descarta en silencio. En una
crisis donde cada registro puede ser una vida, descartar no es aceptable. El
scraper ya enruta esos registros a cuarentena (lado VZLA_DEDUP, issue #88); falta
el lado dataVenezuela: una tabla revisable, con retencion y destruccion auditable,
y el endpoint que la alimenta. Sin esto el staging exporter solo puede fallar,
descartar o guardar fuera de contrato.

## Alcance (cabe en 1 PR)

- Migracion `0011_quarantine.sql`: tabla `public.quarantine_records` con sus
  `CHECK` (enums controlados), `source_slug` con FK a `sources(slug)`, indices de
  revision/retencion/run, RLS y grants (service_role; espejo de
  `aportes`/`source_watermarks`).
- `quarantineInputSchema` (Zod) + enums en `src/lib/validation.ts`.
- Servicio `createQuarantineRecord` (`src/lib/services/quarantine.ts`) con
  validacion de ownership de la fuente.
- Endpoint `POST /api/v1/quarantine` (`src/app/api/v1/quarantine/route.ts`), auth
  `x-api-key`, espejo de `POST /api/aportes`.
- Tipos en `src/lib/database.types.ts` (la tabla nueva).
- Tests (vitest) del servicio y la validacion.

## Contrato / Interfaz

`POST /api/v1/quarantine` — auth `x-api-key`. Body (camelCase, 1 POST por registro):

```json
{
  "runId": "uuid-v4",
  "sourceSlug": "encuentralos",
  "sourceUrl": "https://fuente.org/registro/123",
  "reasonCode": "invalid_schema",
  "reasonDetail": "Error parseando pagina 2",
  "riskLevel": "medium",
  "payloadPreviewRedacted": "fragmento [IDENTITY_DOCUMENT] ...",
  "payloadHash": "64-hex-sin-prefijo",
  "piiFindingsSummary": { "identity_document": 1 }
}
```

Respuestas: `201` insertado · `200` duplicado (mismo `(source_slug, payload_hash)`)
· `401` key invalida · `403` fuente ajena/inexistente · `422` validacion · `500`
error interno.

`reasonCode` ∈ {`pii_untreatable`, `invalid_schema`, `parser_unavailable`,
`pdf_no_text`, `unclassified_sensitive`, `contradictory_sources`,
`ambiguous_manual_review`}. `riskLevel` ∈ {`low`, `medium`, `high`}.

`source_slug` lleva FK a `sources(slug)`; el servicio valida que la fuente
pertenezca al scraper autenticado (igual que `createAporte`). Solo se guarda
preview redactado + hash + metadata: **nunca PII en claro**.

Columnas que gestiona el backend (no el scraper): `quarantine_id`, `review_status`
(default `pending`), `review_decision`, `retention_until`, `destroyed_at`,
`created_at`.

## Criterios de aceptacion

- [ ] `POST /api/v1/quarantine` con key valida y fuente propia inserta una fila y
      devuelve `201` con `{ id, duplicate: false }`.
- [ ] Fuente ajena o inexistente devuelve `403`.
- [ ] Rechaza payloads sin `reasonCode` o `riskLevel` (y enums invalidos) con `422`.
- [ ] Sin `x-api-key` valida → `401`.
- [ ] Reenviar el mismo `(source_slug, payloadHash)` devuelve `200` con
      `duplicate: true` sin insertar de nuevo (idempotencia).
- [ ] La tabla tiene RLS habilitada y grants explicitos; no queda expuesta a anon.
- [ ] La fila guarda `payload_preview_redacted`, `payload_hash` (hex 64) y
      `pii_findings_summary` tal cual llegan; `review_status` arranca en `pending`.
- [ ] La destruccion (futuro) puede borrar contenido dejando `destroyed_at` +
      `payload_hash` — garantizado por el `CHECK` de consistencia.
- [ ] Hay test minimo de servicio/validacion sin red real; `npm run lint` y
      `npm test` pasan.

## Fuera de alcance

- UI/endpoints de revision (listar, aprobar, rechazar, destruir). Van en spec
  aparte. Esta migracion deja la tabla y los estados listos.
- Job de retencion/destruccion automatica.
- Reintroducir a `aportes` un registro `approved_for_staging`.

## Dependencias

- Spec 0013 (aportes + `run_id`): el `run_id` se comparte entre staging y
  cuarentena de la misma corrida.
- Secreto `SUPABASE_SERVICE_ROLE_KEY` (ya existe para `aportes`).

## Verificacion

```bash
supabase db reset          # aplica 0011_quarantine.sql
npm test                   # tests del servicio + validacion
# e2e local (la fuente debe existir y ser del scraper de la key):
curl -sS -X POST localhost:3000/api/v1/quarantine \
  -H "x-api-key: $KEY" -H "content-type: application/json" \
  -d '{"runId":"'"$RUN"'","sourceSlug":"demo","reasonCode":"invalid_schema","riskLevel":"medium","payloadHash":"'$(printf abc | shasum -a256 | cut -d" " -f1)'"}'
```
