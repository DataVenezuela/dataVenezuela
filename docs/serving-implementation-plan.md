# Plan de implementacion — plano publico (Worker/D1)

Desarrolla las piezas pendientes de [`docs/adr/0001`](./adr/0001-arquitectura-serving-publico.md)
en fases ejecutables. El contrato (`docs/openapi-public-serving.json`) y la
proyeccion (`supabase/migrations/0007_public_serving_projection.sql`) **ya existen**
(PR #8) y son el punto de partida. Aqui NO se reabre la decision; se implementa.

Principio: pasos pequenos, una cosa a la vez, con tests. Cada fase es mergeable por
separado.

---

## Lo que ya existe (no se reconstruye)

- Vistas `public_serving_events` / `public_serving_persons` /
  `public_serving_acopio_centers` (`service_role` only).
- Contrato OpenAPI con endpoints y reglas anti-abuso (`nombre>=3`, `limit<=20`).
- Test de contrato `src/lib/public-serving/__tests__/openapi-contract.test.ts`
  (prohibe campos sensibles; verifica anti-enumeracion).

## Estructura objetivo (proyecto Cloudflare aparte o carpeta dedicada)

```text
serving/                       # Worker (TypeScript) + wrangler
├── src/
│   ├── index.ts               # router + fetch handler
│   ├── routes/                # personas, acopio, events, healthz
│   ├── query.ts               # SQL parametrizado (FTS5) sobre D1
│   └── cache.ts               # Cache-Control por endpoint
├── wrangler.toml              # binding D1, rutas
└── test/

scripts/
└── publish-d1.mjs             # job: public_serving_* -> D1 (swap atomico + denylist)
```

---

## Fase 0 — Preparacion

- Crear proyecto Cloudflare (Workers + D1 + Turnstile).
- `wrangler d1 create dv_public`.
- Secretos (nunca en el repo): `SUPABASE_SERVICE_ROLE_KEY` para el job;
  `PII_HMAC_SECRET` solo si se habilita busqueda por cedula.

## Fase 1 — Job de publicacion (la pieza mayor)

`scripts/publish-d1.mjs`, en Node (patron de `scripts/seed.mjs` / `scripts/e2e.mjs`):

1. Lee las vistas `public_serving_*` con cliente service-role (reutiliza
   `src/lib/supabase/admin.ts`).
2. Construye D1: tablas + indices FTS5 sobre nombres; reutiliza enums de
   `src/lib/dedup/enums.ts` para validar.
3. **Swap atomico**: carga en `*_staging` y reemplaza en transaccion; ninguna lectura
   ve estado parcial.
4. **Denylist**: excluye `person_record_id` marcados para borrado (derecho al olvido).
5. Logs sin PII (patron de `src/lib/observability.ts`).

Aceptacion:
- El artefacto D1 publicado no contiene `cedula_hmac` en columnas de salida HTTP
  (el Worker decide la proyeccion) ni ningun campo prohibido.
- Test de swap: una lectura durante el reemplazo nunca observa estado parcial.
- Test de denylist: un id en denylist no aparece en la salida.

## Fase 2 — Worker

`serving/` (TypeScript) implementa el contrato OpenAPI sobre D1:
- Endpoints: `/healthz`, `/v1/personas` (FTS5, max 20), `/v1/personas/{id}`,
  `/v1/acopio`, `/v1/events`.
- SQL siempre parametrizado (`bind`), nunca interpolacion.
- `Cache-Control: public, max-age=120` en busquedas.
- Busqueda por cedula (si se habilita): HMAC server-side **sin loguear**, exige campo
  adicional.

Aceptacion: el **gate es el test existente** `openapi-contract.test.ts` mas tests del
Worker (forma de respuesta, limite 20, `nombre>=3`, ningun campo prohibido).

## Fase 3 — Borde

- Cache rules alineadas con los `Cache-Control` del Worker.
- Rate-limit por IP en `/v1/*`.
- Turnstile ante patrones sospechosos.
- WAF basico (bloqueo de UA de scraping, limites de tamano).

## Fase 4 — CI/CD y operacion

- Cron del job de publicacion (frecuencia alineada al pipeline).
- Deploy del Worker via `wrangler deploy`.
- Runbook de derecho al olvido: anadir id a denylist -> corre el job -> se refleja
  en <=1 ciclo.
- Alertas minimas: job fallido, D1 cerca del tope, error-rate del Worker.

---

## Orden y dependencias

```text
Fase 0 -> Fase 1 -> Fase 2 -> Fase 3 -> Fase 4
```

## Definicion de hecho (global)

```text
Datos publicos = solo proyeccion sanitizada. Verificado por test.
Sin PII en D1, en logs ni en respuestas.
Contrato OpenAPI cubierto por tests.
Job idempotente con swap atomico.
Derecho al olvido propaga en <=1 ciclo.
Costo en reposo ~0.
```

## Pendientes que requieren decision (ver ADR seccion 10 y serving-pii-review.md)

- `is_minor` en la proyeccion publica.
- Detalle de persona enriquecido (notes/sources/photos) en v1.1.
- Mapeo de enums ES->EN en el pipeline de VZLA_DEDUP.
- Mitigacion de exposiciones de PII (`aportes` crudo, `person_notes` a `anon`).
