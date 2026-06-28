# serving — Worker del plano publico

Cloudflare Worker (TypeScript) que sirve la API publica de **solo lectura** sobre un
artefacto **D1**. Sub-proyecto aislado: tooling propio, no se mezcla con el build de
Next.js. Decision: [`docs/adr/0001`](../docs/adr/0001-arquitectura-serving-publico.md).
Contrato: [`docs/openapi-public-serving.json`](../docs/openapi-public-serving.json).

Estado (SPEC-0001): esqueleto + `GET /healthz`, **desplegado**. Los endpoints
`/v1/*` llegan en specs siguientes (ver `docs/specs/README.md`).

- Produccion: https://datavenezuela-serving.evillarroel-dev.workers.dev
- D1: `dv_public` (`71efedc1-e827-447c-b641-aeb2bf76812b`), binding `DB`.

## Desarrollo

```bash
cd serving
npm install
npm test            # unit (vitest)
npm run typecheck   # tsc --noEmit
npm run dev         # wrangler dev -> http://localhost:8787
curl localhost:8787/healthz   # -> {"ok":true}
```

## Recursos en Cloudflare

| Recurso | Valor |
|---|---|
| Worker | `datavenezuela-serving` |
| Cuenta | `6da1df16e7deb65edbfbc69921d0b23f` |
| D1 | `dv_public` / `71efedc1-e827-447c-b641-aeb2bf76812b` (binding `DB`) |

`database_id` y `account_id` no son secretos; viven en `wrangler.toml`. El Worker no
usa secretos en SPEC-0001.

La D1 esta **vacia** hasta que el export de PR #10
(`scripts/export-public-serving-d1.mjs`) la pueble. Con `snapshot_metadata`,
`/healthz` agrega `snapshot_version`; sin ella, responde `{ ok: true }`.

### Recrear los recursos desde cero

```bash
npx wrangler d1 create dv_public      # copia el database_id a wrangler.toml
npx wrangler deploy                   # publica el Worker
```

### Poblar la D1 (preview del flujo de PR #10)

```bash
# desde la raiz del repo, con Supabase configurado:
npm run public-serving:export > /tmp/public-serving.sql
cd serving
npx wrangler d1 execute dv_public --remote --file /tmp/public-serving.sql
```

## Deploy

```bash
cd serving
npx wrangler deploy
# smoke test:
curl https://datavenezuela-serving.evillarroel-dev.workers.dev/healthz   # -> {"ok":true}
```

Logs en vivo: `npx wrangler tail datavenezuela-serving`.
