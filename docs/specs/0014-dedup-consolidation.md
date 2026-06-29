# SPEC-0014 — Esquema de consolidación para el dedup job

| Campo | Valor |
|---|---|
| Estado | en curso |
| Depende de | SPEC-0013 / #15 (staging dedup en `aportes` + `source_watermarks`) |
| ADR / motivacion | — |
| PR | (se completa al abrir) |

## Contexto

El **consolidation job** (proceso externo del pipeline VZLA_DEDUP) lee
`aportes WHERE consolidated_at IS NULL` y decide la deduplicación. Hoy le faltan
estructuras en dataVenezuela: no puede hacer **auto-merge exacto** de `events` y
`acopio_centers` (falta un `UNIQUE (dedup_hash)` que haga el upsert atómico), ni
registrar **candidatos de persona** para revisión humana, ni el **historial de
decisiones**. Este spec es el lado dataVenezuela que desbloquea ese job; continúa el
staging de SPEC-0013.

## Alcance (cabe en 1 PR)

- Migración `supabase/migrations/0009_dedup_consolidation.sql`:
  - `dedup_hash varchar(64)` + índice **UNIQUE** en `events` y `acopio_centers`.
  - Tabla `dedup_candidates` (pares de persona para revisión humana).
  - Tabla `dedup_decisions` (auditoría de decisiones de consolidación).
  - RLS + grants explícitos para las dos tablas nuevas (auto-exposición desactivada).
- Regenerar `src/lib/database.types.ts`.
- Documentar las tablas/columnas nuevas en `docs/api-dedup.md`.

## Contrato / Interfaz

Fuente de verdad: `supabase/migrations/0009_dedup_consolidation.sql`.

- `events.dedup_hash`, `acopio_centers.dedup_hash`: `varchar(64)` nullable, con índice
  UNIQUE (`events_dedup_uniq`, `acopio_centers_dedup_uniq`). Permite upsert atómico
  `ON CONFLICT (dedup_hash)`. NULLs múltiples permitidos (solo deduplica filas con
  hash).
- `dedup_candidates`: `candidate_id` (PK), `event_id` → `events`, `left_person` /
  `right_person` → `persons`, `score numeric(4,3)` ∈ [0,1], `reasons jsonb`,
  `priority` (`high`|`medium`|`low`), `decision` (`pending`|`merged`|`rejected`|
  `deferred`, default `pending`), `created_at`. No permite pares consigo mismos y usa
  índice único canónico para evitar duplicados invertidos `(A,B)` / `(B,A)`.
- `dedup_decisions`: `id` (PK), `aporte_id` → `aportes` (`on delete set null`),
  `entity_type text`, `decision` (`merged`|`discarded`|`promoted`|`candidate`),
  `reason text`, `canonical_id uuid` (polimórfico por `entity_type`, **sin FK**),
  `decided_at`.
- **Acceso**: ambas tablas son internas. RLS habilitada; `service_role` acceso total
  (lo usa el job); admin logueado puede **leer** (`SELECT to authenticated using
  is_admin()` + `grant select to authenticated`). Sin acceso para `anon`.

## Criterios de aceptacion

- [ ] `0009` añade `dedup_hash` + índice UNIQUE a `events` y `acopio_centers`, y crea
      `dedup_candidates` y `dedup_decisions`; `supabase db reset` corre limpio.
- [ ] El UNIQUE sobre `dedup_hash` permite el upsert atómico (insertar dos veces el
      mismo `dedup_hash` con `ON CONFLICT DO NOTHING` no crea dos filas).
- [ ] Las tablas nuevas tienen RLS + grants (service_role total, admin lee).
- [ ] `dedup_candidates` rechaza `(A,A)` y no permite duplicados invertidos.
- [ ] `src/lib/database.types.ts` regenerado incluye las columnas y tablas nuevas.
- [ ] Docs del esquema actualizadas (`docs/api-dedup.md`).

## Fuera de alcance

- El consolidation job en sí (vive en el repo del pipeline).
- Cualquier UI de revisión de `dedup_candidates`.

## Dependencias

- SPEC-0013 / #15: migración `0008_ingesta_staging_dedup.sql` (columnas dedup en
  `aportes`, incl. `consolidated_at`, y `source_watermarks`) debe existir antes.

## Verificacion

```bash
supabase db reset            # 0001..0009 sin error
npm run gen:types

# UNIQUE => upsert atómico (doble insert del mismo hash deja 1 fila)
psql "$DATABASE_URL" -c "insert into events(name,event_type,occurred_at,status,dedup_hash) values('t','other',now(),'active','h1') on conflict (dedup_hash) do nothing;"
psql "$DATABASE_URL" -c "insert into events(name,event_type,occurred_at,status,dedup_hash) values('t2','other',now(),'active','h1') on conflict (dedup_hash) do nothing;"
psql "$DATABASE_URL" -c "select count(*) from events where dedup_hash='h1';"   # => 1

psql "$DATABASE_URL" -c '\d public.dedup_candidates'
psql "$DATABASE_URL" -c '\d public.dedup_decisions'
psql "$DATABASE_URL" -c '\di public.events_dedup_uniq'
```
