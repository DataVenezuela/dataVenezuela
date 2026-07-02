# SPEC-0016 — POST /api/aportes/bulk: ingesta batch de aportes

| Campo | Valor |
|---|---|
| Estado | hecho |
| Depende de | SPEC-0013 (staging fields en aportes) |
| ADR / motivacion | — |
| PR | db-api/194-bulk-aportes-endpoint |

## Contexto

Los scrapers necesitan ingestar lotes de cientos de registros por run sin disparar
una request HTTP por ítem. El endpoint individual (`POST /api/aportes`) no escala
para runs de pipelines automatizados. Se requiere un endpoint batch que mantenga
idempotencia por `externalId` y devuelva un resumen parcial incluso si algunos
ítems fallan.

## Alcance (cabe en 1 PR)

- `POST /api/aportes/bulk` autenticado con `x-api-key`.
- Acepta hasta 500 aportes por request (`aportes: AporteInput[]`).
- Resuelve fuentes por `sourceId` o `sourceSlug` (fallback: slug si ID no resuelve).
- Deduplica por `externalId` en batch antes de insertar (incluye dedup intra-batch).
- Usa `ON CONFLICT DO NOTHING` en el INSERT para absorber carreras sin retry secuencial.
- Responde `{ sent, duplicates, errors }` con HTTP 200 si al menos un ítem se procesó,
  422 si todos los ítems fallaron.

## Contrato / Interfaz

```
POST /api/aportes/bulk
x-api-key: <partner key>
Content-Type: application/json

{
  "aportes": [AporteInput, ...]   // hasta 500 ítems
}

200 OK  (al menos un ítem procesado)
422     (todos los ítems fallaron — validación o fuente no encontrada)
401     (API key inválida o ausente)
400     (JSON malformado)
422     (body no cumple aportesBulkBodySchema)

{
  "sent": number,        // aportes nuevos insertados
  "duplicates": number,  // aportes ya existentes (idempotencia)
  "errors": string[]     // errores por ítem, no abortan el batch
}
```

`AporteInput` está definido en `src/lib/validation.ts` (`aporteInputSchema`).

## Criterios de aceptacion

- [x] Request con 0 ítems responde 200 `{ sent:0, duplicates:0, errors:[] }`.
- [x] Ítems con `externalId` ya existente se cuentan como `duplicates`, no `errors`.
- [x] Dos ítems con el mismo `externalId` en el mismo request: uno se inserta, el otro es `duplicate`.
- [x] Si `sourceId` no resuelve pero `sourceSlug` sí, el ítem se inserta (fallback a slug).
- [x] Error de DB en la query de fuentes propaga excepción (no silencia y retorna 200).
- [x] Batch 100 % inválido (schema) retorna HTTP 422.
- [x] Ítem inválido no aborta el resto del batch; aparece en `errors[]`.
- [x] Race condition de `externalId` (23505 en upsert) no lanza excepción; se cuenta como `duplicate`.
- [x] Error no-conflicto en el INSERT retorna resultado parcial (ítem a ítem), no lanza.

## Fuera de alcance

- Validación semántica del `rawJson` / `rawText` (responsabilidad del pipeline de dedup).
- Rate limiting por partner (SPEC-0007).
- Respuestas por ítem con HTTP 207 Multi-Status (batches mezclados éxito/error se reportan vía `errors[]`).

## Dependencias

- `partner_api_keys` y `authenticate_partner` deben existir (SPEC-0015).
- Tabla `aportes` con `external_id UNIQUE` (schema_remote.sql).

## Verificacion

```bash
# Happy path
curl -X POST /api/aportes/bulk \
  -H "x-api-key: $KEY" \
  -d '{"aportes":[{"sourceSlug":"mi-fuente","rawText":"hola"}]}'
# → 200 { sent:1, duplicates:0, errors:[] }

# Idempotencia
# (misma request dos veces → segunda vez duplicates:1)

# Batch 100 % inválido
curl -X POST /api/aportes/bulk \
  -H "x-api-key: $KEY" \
  -d '{"aportes":[{"rawText":123}]}'
# → 422

# Tests
pnpm test src/lib/services/aportes
```
