-- PostgREST/Data API: las tablas del esquema dedup NO se exponen automáticamente
-- (auto_expose_new_tables desactivado) y los GRANTs de 0003 solo cubren las tablas
-- que existían entonces. Aquí damos los GRANTs explícitos de las 6 tablas nuevas.
-- La RLS de 0005 sigue filtrando qué fila/operación pasa por cada rol.
--
-- Lectura pública: anon/authenticated pueden leer, PERO las columnas sensibles
-- (cedula_hmac, contact_hmac) quedan fuera del grant de columna — solo service_role
-- (o admin vía route handler con service_role) las ve. Los GRANT de columna y los de
-- tabla completa son excluyentes en Postgres, así que para persons/acopio_centers el
-- SELECT se concede columna por columna (todas menos el HMAC).

-- service_role: acceso total (bypassa RLS) para route handlers y server actions.
grant all privileges on
  public.events,
  public.persons,
  public.person_notes,
  public.person_sources,
  public.person_photos,
  public.acopio_centers
to service_role;

-- authenticated (scraper / admin logueado): la RLS limita el acceso real por rol.
-- En persons/acopio_centers el SELECT se da por columna (más abajo); aquí solo las
-- operaciones de escritura.
grant insert, update, delete on
  public.events,
  public.persons,
  public.person_notes,
  public.person_sources,
  public.person_photos,
  public.acopio_centers
to authenticated;

-- ----------------------------------------------------------------------------
-- SELECT público (anon + authenticated)
-- ----------------------------------------------------------------------------

-- Tablas sin columnas sensibles: SELECT de tabla completa.
grant select on
  public.events,
  public.person_notes,
  public.person_sources,
  public.person_photos
to anon, authenticated;

-- persons: SELECT de todas las columnas EXCEPTO cedula_hmac.
grant select (
  person_record_id,
  event_id,
  full_name,
  alternate_names,
  cedula_masked,
  age_range,
  sex,
  is_minor,
  last_known_location,
  status,
  verification_status,
  confidence_score,
  source_url
) on public.persons to anon, authenticated;

-- acopio_centers: SELECT de todas las columnas EXCEPTO contact_hmac.
grant select (
  acopio_id,
  event_id,
  name,
  location,
  confidence_score,
  status,
  needs,
  last_verified_at,
  managing_org,
  contact_masked,
  capacity,
  current_load
) on public.acopio_centers to anon, authenticated;
