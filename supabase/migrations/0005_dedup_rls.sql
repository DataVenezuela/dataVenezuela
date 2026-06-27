-- Row Level Security — esquema dedup (Vzla_Dedup)
--
-- Modelo de acceso para las 6 tablas normalizadas:
--   * SELECT (lectura): cualquiera (anon + authenticated). Es data pública de crisis.
--     Las columnas sensibles (cedula_hmac, contact_hmac) se protegen por GRANT de
--     columna en 0006_dedup_grants.sql, no por RLS (RLS filtra filas, no columnas).
--   * INSERT (ingesta): solo scraper o admin.
--   * UPDATE / DELETE (modificar): solo admin.
--   * service_role bypassa RLS; el pipeline de ingesta sigue escribiendo por ahí.
--
-- Reutiliza los helpers de 0002_rls.sql: public.auth_role() y public.is_admin().

-- ----------------------------------------------------------------------------
-- Helper: ¿el usuario puede ingerir (insertar) registros del pipeline?
-- ----------------------------------------------------------------------------
create or replace function public.can_ingest()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('scraper', 'admin'), false)
$$;

-- ----------------------------------------------------------------------------
-- Habilitar RLS
-- ----------------------------------------------------------------------------
alter table public.events         enable row level security;
alter table public.persons        enable row level security;
alter table public.person_notes   enable row level security;
alter table public.person_sources enable row level security;
alter table public.person_photos  enable row level security;
alter table public.acopio_centers enable row level security;

-- ----------------------------------------------------------------------------
-- events
-- ----------------------------------------------------------------------------
create policy events_select_public on public.events
  for select to anon, authenticated using (true);
create policy events_insert_ingest on public.events
  for insert to authenticated with check (public.can_ingest());
create policy events_update_admin on public.events
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy events_delete_admin on public.events
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- persons
-- ----------------------------------------------------------------------------
create policy persons_select_public on public.persons
  for select to anon, authenticated using (true);
create policy persons_insert_ingest on public.persons
  for insert to authenticated with check (public.can_ingest());
create policy persons_update_admin on public.persons
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy persons_delete_admin on public.persons
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- person_notes
-- ----------------------------------------------------------------------------
create policy person_notes_select_public on public.person_notes
  for select to anon, authenticated using (true);
create policy person_notes_insert_ingest on public.person_notes
  for insert to authenticated with check (public.can_ingest());
create policy person_notes_update_admin on public.person_notes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy person_notes_delete_admin on public.person_notes
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- person_sources
-- ----------------------------------------------------------------------------
create policy person_sources_select_public on public.person_sources
  for select to anon, authenticated using (true);
create policy person_sources_insert_ingest on public.person_sources
  for insert to authenticated with check (public.can_ingest());
create policy person_sources_update_admin on public.person_sources
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy person_sources_delete_admin on public.person_sources
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- person_photos
-- ----------------------------------------------------------------------------
create policy person_photos_select_public on public.person_photos
  for select to anon, authenticated using (true);
create policy person_photos_insert_ingest on public.person_photos
  for insert to authenticated with check (public.can_ingest());
create policy person_photos_update_admin on public.person_photos
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy person_photos_delete_admin on public.person_photos
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- acopio_centers
-- ----------------------------------------------------------------------------
create policy acopio_centers_select_public on public.acopio_centers
  for select to anon, authenticated using (true);
create policy acopio_centers_insert_ingest on public.acopio_centers
  for insert to authenticated with check (public.can_ingest());
create policy acopio_centers_update_admin on public.acopio_centers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy acopio_centers_delete_admin on public.acopio_centers
  for delete to authenticated using (public.is_admin());
