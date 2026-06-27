-- Row Level Security
--
-- Modelo de acceso (v1):
--  * Las ESCRITURAS (ingesta por API, gestión de scrapers/keys/fuentes) pasan por
--    route handlers / server actions que usan el cliente service-role (bypassa RLS)
--    y validan la API key o el rol en código.
--  * La LECTURA pública de aportes/fuentes se sirve desde nuestros route handlers
--    (service-role, columnas seguras), así que no exponemos `anon` por la Data API.
--  * RLS es la red de seguridad para usuarios autenticados (scraper / admin).

-- ----------------------------------------------------------------------------
-- Helpers de rol (security definer para poder leer profiles bajo RLS)
-- ----------------------------------------------------------------------------
create or replace function public.auth_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

-- ----------------------------------------------------------------------------
-- Habilitar RLS
-- ----------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.sources              enable row level security;
alter table public.scraper_applications enable row level security;
alter table public.partner_api_keys     enable row level security;
alter table public.aportes              enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.auth_role());  -- no auto-escalar rol

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- sources  (el dueño lee la suya; el admin gestiona todas; lectura pública vía API)
-- ----------------------------------------------------------------------------
create policy sources_select_owner_or_admin on public.sources
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy sources_admin_write on public.sources
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- scraper_applications  (el solicitante ve la suya; el admin gestiona todas)
-- ----------------------------------------------------------------------------
create policy scraper_applications_select_own_or_admin on public.scraper_applications
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy scraper_applications_admin_all on public.scraper_applications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- partner_api_keys  (solo admin vía RLS; el scraper las gestiona vía service role
--                    en /account; la verificación de keys también va por service role)
-- ----------------------------------------------------------------------------
create policy partner_api_keys_admin on public.partner_api_keys
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- aportes  (sin políticas: escritura e ingesta por service role; lectura pública
--           vía route handlers con service role y columnas seguras)
-- ----------------------------------------------------------------------------
