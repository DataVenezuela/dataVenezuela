# SPEC-0001 — Worker skeleton + /healthz

| Campo | Valor |
|---|---|
| Estado | en curso |
| Depende de | — |
| ADR / motivacion | `adr/0001`, `serving-implementation-plan.md` (Fase 2) |
| PR | <pendiente> |

## Contexto

El plano publico (ADR 0001) se sirve con un Cloudflare Worker sobre D1. Aun no
existe el runtime del Worker en el repo. Este spec crea el esqueleto minimo del
Worker y el primer endpoint, `GET /healthz`, para tener una base desplegable sobre
la que anadir los endpoints `/v1/*` en specs siguientes.

## Alcance (cabe en 1 PR)

- Sub-proyecto aislado en `serving/` (Worker en TypeScript, tooling propio; no se
  mezcla con el build de Next.js).
- Router minimo (metodo + path -> handler) y `fetch` handler con 404 por defecto.
- Endpoint `GET /healthz`.
- Tests unitarios del handler de healthz.
- `serving/README.md` con como correr/test/deploy.

## Contrato / Interfaz

Fuente de verdad: `docs/openapi-public-serving.json` -> `HealthResponse`.

```
GET /healthz  -> 200 application/json
HealthResponse = {
  ok: boolean,            // requerido
  snapshot_version?: string   // version/timestamp del artefacto D1 activo
}
additionalProperties: false
```

Comportamiento:
- `ok: true` siempre que el Worker responde.
- Si el binding D1 esta presente, leer `snapshot_metadata` y agregar
  `snapshot_version` (mapeado del `generated_at` que escribe el export de PR #10).
- En `try/catch`: si no hay D1 o la consulta falla, omitir `snapshot_version` y
  mantener `ok: true`. No romper por ausencia de artefacto.

## Criterios de aceptacion

- [ ] `GET /healthz` responde `200` con `{ "ok": true }` cuando no hay D1.
- [ ] Con un D1 que tiene `snapshot_metadata`, la respuesta incluye
      `snapshot_version` (string).
- [ ] La respuesta no incluye campos fuera de `HealthResponse`
      (`additionalProperties: false`).
- [ ] Rutas desconocidas responden `404`.
- [ ] `cd serving && npm test` pasa.
- [ ] El handler es una funcion pura testeable sin el runtime de Workers.

## Fuera de alcance

- Endpoints `/v1/personas`, `/v1/acopio`, `/v1/events` (specs 0003-0005).
- Crear/poblar la D1 real y el binding definitivo (Fase 0 / SPEC-0002).
- Cache, rate-limit, Turnstile, WAF (specs 0006-0007).
- CI/CD y deploy automatizado (SPEC-0009).

## Dependencias

- Ninguna bloqueante. El binding D1 es opcional en este spec (placeholder en
  `wrangler.toml`); la D1 real llega en SPEC-0002.

## Verificacion

```bash
cd serving
npm install
npm test                       # unit de healthz (con y sin D1)
npx wrangler dev               # local (D1 local de miniflare)
curl localhost:8787/healthz    # -> {"ok":true}
```
Confirmar que la forma coincide con `HealthResponse` en
`docs/openapi-public-serving.json`.
