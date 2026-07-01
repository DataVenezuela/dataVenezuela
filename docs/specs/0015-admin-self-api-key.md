# SPEC-0015 — Admin auto-genera su propia API key

| Campo | Valor |
|---|---|
| Estado | hecho |
| Depende de | — |
| ADR / motivacion | — |
| PR | #32 |

## Contexto

Hoy solo un **scraper aprobado** (`role = "scraper"` + `scraper_status = "approved"`)
puede crear API keys en `/account`; un **admin** no puede, pese a que la ingesta
(`/api/aportes`, `/api/v1/dedup/*`) **no valida el rol**: autentica por `x-api-key` →
`owner_id` y solo exige que la `source` pertenezca a ese owner. Un admin que quiera
recolectar datos no tiene forma de obtener una key. Este spec permite que un admin
**solicite una API key en un solo paso**, conservando su rol, sin migración.

## Alcance (cabe en 1 PR)

- Helper compartido `src/lib/sources.ts`: `uniqueSourceSlug` (extraído de
  `admin/users/actions.ts`) y `ensureOwnerSource(supabase, ownerId, name)`
  (auto-crea una fuente sin website si el owner no tiene ninguna; idempotente).
- `src/app/account/actions.ts`: `getApiKeyOwnerId()` (scraper aprobado **o** admin),
  nueva `requestAdminApiKeyAction` (gate admin → asegura fuente propia → crea key con
  nombre automático), y `revokeApiKeyAction` generalizada a admins.
- UI en `/account`: el bloque de fuentes + keys se muestra también a admins; el admin
  ve `RequestAdminKeyForm` (botón único "Solicitar API key", sin campos).
- Tests unitarios (vitest) de la acción y del helper.

## Contrato / Interfaz

Fuente de verdad: `src/app/account/actions.ts`, `src/lib/sources.ts`.

- `requestAdminApiKeyAction(prev: CreateKeyState): Promise<CreateKeyState>` —
  server action. Solo `role = "admin"`. Auto-crea la fuente del admin si no tiene
  (vía `ensureOwnerSource`), inserta en `partner_api_keys`
  (`owner_id = <admin>`, `name = "Admin · <fecha>"`, `active = true`) y devuelve
  `{ ok: true, key }` con la key en claro **una sola vez**; en error
  `{ ok: false, error }`.
- `ensureOwnerSource(supabase, ownerId, name): Promise<void>` — no-op si el owner ya
  tiene fuente; si no, inserta `{ name, slug: uniqueSourceSlug(name), website: null,
  owner_id }`.
- Sin cambios de esquema, RLS ni endpoints. La autenticación de la key reutiliza
  `authenticatePartner` (`src/lib/partners.ts`) sin cambios.

## Criterios de aceptacion

- [x] Un admin en `/account` ve "Solicitar API key"; al pulsarlo recibe una `dv_…`
      mostrada una sola vez y la key queda listada.
- [x] Al solicitar su primera key, el admin obtiene una `source` con
      `owner_id = <admin>` (auto-creada); solicitar una segunda key no crea otra
      fuente.
- [x] Esa key autentica contra `POST /api/aportes` con el `source_id` de su fuente.
- [x] El admin puede revocar **sus** keys (quedan `active = false`).
- [x] Un no-admin que invoque `requestAdminApiKeyAction` recibe error y no se crea
      nada.
- [x] El flujo de scraper (`CreateKeyForm`, `/register`, aprobación) sigue intacto.
- [x] `npm test`, `npm run lint` y `tsc --noEmit` pasan.

## Fuera de alcance

- No hay migración de base de datos (esquema y RLS ya existen; las acciones usan
  `service_role`).
- No se cambia el rol del admin a `scraper` ni se modifica el flujo de scrapers.
- Sin UI nueva en el panel `/admin` (la gestión vive en `/account`).

## Dependencias

- Ninguna. Reutiliza `partner_api_keys`, `sources`, `profiles` (0001) y
  `generateApiKey`/`hashApiKey` (`src/lib/api-keys.ts`).

## Verificacion

```bash
npm run lint
npx tsc --noEmit
npm test                       # unit de requestAdminApiKeyAction + ensureOwnerSource

# Dev local (puerto fallback 3100): login como admin → /account → "Solicitar API key".
# Usar la key devuelta:
curl -X POST localhost:3100/api/aportes \
  -H "x-api-key: dv_…" -H 'content-type: application/json' \
  -d '{"source_id":"<id de la fuente auto-creada>","raw_text":"prueba"}'   # => created
```
