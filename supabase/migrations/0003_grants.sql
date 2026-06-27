-- PostgREST/Data API: las tablas nuevas NO se exponen automáticamente
-- (auto_expose_new_tables desactivado), así que damos GRANTs explícitos.
-- La Row Level Security sigue filtrando qué fila puede ver/escribir cada rol.

grant usage on schema public to anon, authenticated, service_role;

-- service_role: acceso total (bypassa RLS) para route handlers y server actions.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- authenticated (scraper / admin logueado): la RLS limita el acceso real por rol.
grant select, insert, update, delete on
  public.profiles,
  public.sources,
  public.scraper_applications,
  public.partner_api_keys
to authenticated;

-- aportes: sin grant a anon/authenticated. La ingesta y la lectura pública pasan
-- por nuestros route handlers con el cliente service-role.
