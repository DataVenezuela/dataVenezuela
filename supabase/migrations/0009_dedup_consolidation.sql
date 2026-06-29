-- Dedup consolidation (SPEC-0014)
--
-- Estructuras que el consolidation job (proceso externo del pipeline VZLA_DEDUP)
-- necesita para procesar `aportes WHERE consolidated_at IS NULL` (las columnas de
-- staging las trajo 0008 / SPEC-0013). Aquí construimos el lado dataVenezuela:
--   * `dedup_hash` + índice UNIQUE en `events` y `acopio_centers`, para auto-merge
--     exacto vía upsert atómico (ON CONFLICT) sin que el job tenga que lockear.
--   * `dedup_candidates`: pares de persona para revisión humana (NUNCA auto-merge).
--   * `dedup_decisions`: auditoría de las decisiones de consolidación.
--
-- Convenciones del repo: enums por CHECK (ver 0004), no enums nativos; las tablas
-- nuevas NO se auto-exponen (auto_expose_new_tables desactivado), así que la RLS y
-- los GRANTs van explícitos (ver 0003/0006/0008). Reutiliza public.is_admin() (0002).

-- ----------------------------------------------------------------------------
-- dedup_hash + UNIQUE para auto-merge atómico (events, acopio_centers)
-- ----------------------------------------------------------------------------
-- Nullable a propósito: en Postgres el UNIQUE admite múltiples NULL, así que solo
-- deduplica filas que ya tienen hash; las filas sin hash conviven sin colisionar.
alter table public.events
  add column dedup_hash varchar(64);
alter table public.acopio_centers
  add column dedup_hash varchar(64);

create unique index events_dedup_uniq
  on public.events (dedup_hash);
create unique index acopio_centers_dedup_uniq
  on public.acopio_centers (dedup_hash);

comment on index public.events_dedup_uniq is
  'Auto-merge atómico por dedup_hash (ON CONFLICT). NULLs múltiples permitidos: solo deduplica filas con hash.';
comment on index public.acopio_centers_dedup_uniq is
  'Auto-merge atómico por dedup_hash (ON CONFLICT). NULLs múltiples permitidos: solo deduplica filas con hash.';

-- ----------------------------------------------------------------------------
-- dedup_candidates: pares de persona para revisión humana
-- ----------------------------------------------------------------------------
create table public.dedup_candidates (
  candidate_id  uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(event_id) on delete cascade,
  left_person   uuid not null references public.persons(person_record_id) on delete cascade,
  right_person  uuid not null references public.persons(person_record_id) on delete cascade,
  score         numeric(4,3) not null check (score >= 0 and score <= 1),
  reasons       jsonb,
  priority      text not null
                  check (priority in ('high', 'medium', 'low')),
  decision      text not null default 'pending'
                  check (decision in ('pending', 'merged', 'rejected', 'deferred')),
  created_at    timestamptz not null default now(),
  check (left_person <> right_person)
);

create index dedup_candidates_event_id_idx     on public.dedup_candidates (event_id);
create index dedup_candidates_left_person_idx  on public.dedup_candidates (left_person);
create index dedup_candidates_right_person_idx on public.dedup_candidates (right_person);
create unique index dedup_candidates_pair_uniq
  on public.dedup_candidates (least(left_person, right_person), greatest(left_person, right_person));

-- ----------------------------------------------------------------------------
-- dedup_decisions: auditoría de decisiones de consolidación
-- ----------------------------------------------------------------------------
create table public.dedup_decisions (
  id           uuid primary key default gen_random_uuid(),
  aporte_id    uuid references public.aportes(id) on delete set null,
  entity_type  text not null,
  decision     text not null
                 check (decision in ('merged', 'discarded', 'promoted', 'candidate')),
  reason       text,
  canonical_id uuid,
  decided_at   timestamptz not null default now()
);

create index dedup_decisions_aporte_id_idx on public.dedup_decisions (aporte_id);

comment on column public.dedup_decisions.canonical_id is
  'ID canónico polimórfico según entity_type (events/persons/acopio_centers); sin FK a propósito.';

-- ----------------------------------------------------------------------------
-- RLS + grants (tablas internas: el job escribe vía service_role; admin lee)
-- ----------------------------------------------------------------------------
-- Estas tablas NO son data pública: a diferencia de las 6 tablas dedup (0005/0006),
-- aquí no hay SELECT para anon. service_role tiene acceso total (bypassa RLS) y un
-- admin logueado puede leer la cola/auditoría directo (Data API / Studio).
alter table public.dedup_candidates enable row level security;
alter table public.dedup_decisions  enable row level security;

create policy dedup_candidates_select_admin on public.dedup_candidates
  for select to authenticated using (public.is_admin());
create policy dedup_decisions_select_admin on public.dedup_decisions
  for select to authenticated using (public.is_admin());

-- service_role: acceso total (lo usa el consolidation job vía route handler/server).
grant all privileges on public.dedup_candidates to service_role;
grant all privileges on public.dedup_decisions  to service_role;

-- authenticated: solo lectura; la RLS de arriba la limita a admins.
grant select on public.dedup_candidates to authenticated;
grant select on public.dedup_decisions  to authenticated;
