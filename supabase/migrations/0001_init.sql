-- dataVenezuela — esquema inicial (v1)
-- Dos tablas núcleo:
--   * sources  — la fuente de los datos (la propone/asigna el equipo).
--   * aportes  — los datos en bruto subidos por un scraper, SIN esquema estricto
--                (jsonb + texto), para poder ingerir cualquier tipo de información.
-- El resto de tablas existe para que esas dos funcionen (perfiles, solicitudes de
-- scraper, API keys). La verificación se construirá más adelante sobre `aportes`.

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type user_role as enum ('public_submitter', 'scraper', 'admin');

-- ----------------------------------------------------------------------------
-- Trigger helper: mantiene updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles (espejo de auth.users con rol y estado de scraper)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text,
  full_name      text,
  role           user_role not null default 'public_submitter',
  -- estado del trámite de scraper (null si no aplica)
  scraper_status text check (scraper_status in ('pending', 'approved', 'rejected')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea un profile automáticamente cuando se registra un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- sources (fuente de datos; campos públicos mínimos)
-- ----------------------------------------------------------------------------
create table public.sources (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,                                    -- identificador estable legible
  website    text,
  owner_id   uuid references public.profiles(id) on delete set null,  -- scraper dueño (null = del sistema)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

create index sources_owner_id_idx on public.sources (owner_id);

-- ----------------------------------------------------------------------------
-- scraper_applications (solicitud auditable de alta de scraper)
-- ----------------------------------------------------------------------------
create table public.scraper_applications (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  source_name  text not null,        -- nombre de la fuente / scraper propuesta
  website      text,
  social_url   text,
  description  text,                 -- qué datos recolecta y de dónde
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index scraper_applications_profile_id_idx on public.scraper_applications (profile_id);
create index scraper_applications_status_idx on public.scraper_applications (status);

-- ----------------------------------------------------------------------------
-- partner_api_keys (autenticación de escritura; la key identifica al scraper)
-- ----------------------------------------------------------------------------
create table public.partner_api_keys (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,  -- scraper dueño de la key
  name         text not null,
  key_hash     text not null unique,   -- sha256(API key + PARTNER_API_SALT); nunca en claro
  last_used_at timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index partner_api_keys_owner_id_idx on public.partner_api_keys (owner_id);

-- ----------------------------------------------------------------------------
-- aportes (tabla núcleo flexible: datos en bruto sin esquema estricto)
-- ----------------------------------------------------------------------------
create table public.aportes (
  id          uuid primary key default gen_random_uuid(),                    -- id interno
  external_id text,                                                          -- id externo del scraper
  raw_json    jsonb,
  raw_text    text,
  source_id   uuid references public.sources(id)  on delete set null,
  scraper_id  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint aportes_has_payload check (raw_json is not null or raw_text is not null)
);

create trigger aportes_set_updated_at
  before update on public.aportes
  for each row execute function public.set_updated_at();

-- Anti-duplicados por usuario: un mismo scraper no puede subir dos veces el mismo
-- external_id (capa adicional configurada por cada dev/scraper).
create unique index aportes_scraper_external_unique_idx
  on public.aportes (scraper_id, external_id)
  where scraper_id is not null and external_id is not null;

create index aportes_source_id_idx  on public.aportes (source_id);
create index aportes_scraper_id_idx on public.aportes (scraper_id);
create index aportes_created_at_idx on public.aportes (created_at desc);
