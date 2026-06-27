# dataVenezuela

Plataforma de **ingesta de datos**. Los scrapers suben **aportes** por API,
atribuidos a una **fuente**. Los aportes se guardan en bruto (JSON + texto), sin
esquema estricto, para adaptarse a cualquier tipo de información. La verificación
se construirá más adelante sobre los aportes.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase: Postgres + Auth
- `@supabase/supabase-js` + `@supabase/ssr`, Zod
- Node 24 (ver `.nvmrc`)

> Nota Next.js 16: el antiguo `middleware.ts` se llama ahora **`proxy.ts`** (ver
> `src/proxy.ts`), y `params`/`searchParams`/`cookies()` son asíncronos.

## Modelo de datos

Dos tablas núcleo:

- **`sources`** — la fuente de los datos (`name`, `slug`, `website`, `owner_id`).
  La crea/asigna el equipo. Un scraper puede tener varias fuentes (`owner_id`).
- **`aportes`** — los datos en bruto: `external_id`, `raw_json` (jsonb),
  `raw_text`, `source_id`, `scraper_id`. Anti-duplicados por
  `(scraper_id, external_id)`.

Tablas de apoyo: `profiles` (rol + estado de scraper), `scraper_applications`
(solicitudes), `partner_api_keys` (keys de escritura ligadas al scraper).

Esquema en `supabase/migrations/`.

## Serving publico

La API publica de consulta se define como un plano separado: Cloudflare Worker +
D1/SQLite, alimentado por una proyeccion segura de Supabase. Este repo mantiene
la proyeccion de BD y el contrato OpenAPI; el trafico publico no debe consultar
Supabase directamente.

- Proyeccion: `supabase/migrations/0007_public_serving_projection.sql`
- Contrato HTTP: `docs/openapi-public-serving.json`
- Guia: `docs/serving-publico.md`

**Acceso:** la **escritura** (ingesta) requiere `x-api-key`; la **lectura** de
aportes es **pública** vía los route handlers (cliente service-role, columnas
seguras). Las acciones internas (gestión de scrapers/fuentes/keys) validan rol en
código; RLS es la red de seguridad para usuarios autenticados.

## Puesta en marcha

```bash
nvm use                # Node 24
npm install
npx supabase start     # levanta Postgres/Auth en Docker
npm run db:reset       # aplica migraciones (supabase/seed.sql está vacío a propósito)
npm run seed           # crea admin + scraper aprobado con fuente, key y aportes demo
npm run dev            # http://localhost:3000  (usa PORT=3100 npm run dev si está ocupado)
```

### Puertos locales (personalizados)

Rango propio para **coexistir con otros proyectos Supabase locales**:

| Servicio | Puerto |
| --- | --- |
| API (REST/Auth) | `54421` |
| Postgres | `54422` |
| Studio | `54423` |
| Mailpit | `54424` |

Las claves locales y URLs ya están en `.env.local`.

### Credenciales sembradas (solo desarrollo)

| Rol | Email | Contraseña |
| --- | --- | --- |
| admin | `admin@datavenezuela.local` | `Admin12345!` |
| scraper (aprobado) | `scraper@datavenezuela.local` | `Scraper12345!` |
| scraper (pendiente) | `scraper-pending@datavenezuela.local` | `Scraper12345!` |

API key del scraper demo: header `x-api-key: demo-scraper-key`.

## Rutas

**Público:** `/` · `/docs` (guía de la API para scrapers) · `/sources` · `/register` · `/login` · `/account`
**Panel (admin, login en `/login`):** `/admin/users` · `/admin/sources`

**API:**
- `POST /api/aportes` — ingesta (header `x-api-key`; cuerpo con `sourceId` **o**
  `sourceSlug`, `externalId`, `rawJson`/`rawText`). El sistema resuelve la fuente
  al id. Idempotente por `(scraper_id, external_id)`.
- `GET /api/aportes` — lectura pública (filtros `source_id`, `external_id`;
  paginación `limit`/`offset`).
- `GET /api/aportes/:id` — lectura pública por id interno.

Ejemplo de ingesta:

```bash
curl -X POST http://localhost:3000/api/aportes \
  -H "x-api-key: demo-scraper-key" \
  -H "content-type: application/json" \
  -d '{"sourceSlug":"<slug de tu fuente>","externalId":"abc-123","rawJson":{"k":"v"}}'
```

## Scripts

- `npm run dev` / `build` / `start` / `lint`
- `npm run db:reset` — recrea la BD con las migraciones
- `npm run gen:types` — regenera `src/lib/database.types.ts`
- `npm run seed` — admin + scraper demo (fuente, key, aportes)
- `npm run e2e` — prueba la ingesta y la lectura pública (requiere `dev` + `seed`)
