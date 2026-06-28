# serving — Worker del plano publico

Cloudflare Worker (TypeScript) que sirve la API publica de **solo lectura** sobre un
artefacto **D1**. Sub-proyecto aislado: tooling propio, no se mezcla con el build de
Next.js. Decision: [`docs/adr/0001`](../docs/adr/0001-arquitectura-serving-publico.md).
Contrato: [`docs/openapi-public-serving.json`](../docs/openapi-public-serving.json).

Estado (SPEC-0001): esqueleto + `GET /healthz`. Los endpoints `/v1/*` llegan en
specs siguientes (ver `docs/specs/README.md`).

## Desarrollo

```bash
cd serving
npm install
npm test            # unit (vitest)
npm run typecheck   # tsc --noEmit
npm run dev         # wrangler dev -> http://localhost:8787
curl localhost:8787/healthz   # -> {"ok":true}
```

## D1

El binding `DB` esta comentado en `wrangler.toml` hasta SPEC-0002. Sin D1, `/healthz`
responde `{ ok: true }`. Con D1 (artefacto de PR #10), agrega `snapshot_version`
leido de `snapshot_metadata`.

Para conectar la D1 real:

```bash
npx wrangler d1 create dv_public      # copia el database_id al wrangler.toml
# descomenta el bloque [[d1_databases]] y completa database_id
```

## Deploy

```bash
npx wrangler deploy
```
