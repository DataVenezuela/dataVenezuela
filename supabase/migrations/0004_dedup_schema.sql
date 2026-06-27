-- dataVenezuela — esquema normalizado y deduplicado (Vzla_Dedup v1.0, Junio 2026)
--
-- Mientras `aportes` (0001) guarda datos en bruto sin esquema estricto, estas 6
-- tablas son el modelo NORMALIZADO y DEDUPLICADO que el pipeline produce a partir
-- de esos aportes. Compatibilidad objetivo: PostgreSQL 14+.
--
-- Convenciones del spec aplicadas aquí:
--   * Zona horaria: UTC siempre -> timestamptz.
--   * Booleanos: boolean nativo (nunca 0/1 ni "Si"/"No").
--   * Nulos: null explícito (nunca "", "N/A" ni 0 como sustituto).
--   * IDs internos: UUID v4. El spec admite "varchar(36) / uuid"; usamos el tipo
--     `uuid` nativo (mejor indexado/validación y consistente con 0001). El scraper
--     puede generar el UUID en cliente e insertarlo en batch JSONL; el default
--     gen_random_uuid() solo aplica si no se provee.
--   * Enums: varchar con check de valores controlados (no tipo ENUM nativo, difícil
--     de migrar).
--   * HMAC: varchar(64) — SHA-256 en hex.
--   * Confianza / scores: numeric(4,3), rango 0.000 a 1.000.
--   * location_object / listas: jsonb.
--
-- updated_at: el spec NO lista columnas updated_at en estas entidades, así que no
-- las agregamos (los registros se reescriben por el pipeline de dedup, no se editan
-- a mano). Por eso tampoco hay triggers set_updated_at aquí.

-- ----------------------------------------------------------------------------
-- events — el evento de crisis que agrupa personas y centros de acopio
-- ----------------------------------------------------------------------------
create table public.events (
  event_id        uuid primary key default gen_random_uuid(),
  name            varchar(255) not null,                 -- "Terremoto Yaracuy 24-06-2026"
  event_type      varchar(50)  not null
                    check (event_type in ('earthquake', 'flood', 'landslide', 'other')),
  occurred_at     timestamptz  not null,
  affected_states jsonb,                                 -- array<string> de estados venezolanos
  magnitude       numeric(4,2),                          -- escala Richter/Momento
  depth_km        numeric(6,2),
  status          varchar(30)  not null
                    check (status in ('active', 'monitoring', 'closed')),
  external_ids    jsonb                                  -- {"usgs":"...","funvisis":"..."}
);

create index events_status_idx      on public.events (status);
create index events_occurred_at_idx on public.events (occurred_at desc);

-- ----------------------------------------------------------------------------
-- persons — identidad deduplicada de una persona dentro de un evento
-- ----------------------------------------------------------------------------
create table public.persons (
  person_record_id    uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(event_id) on delete cascade,
  full_name           varchar(300),                      -- normalizado, sin tildes/mayúsculas
  alternate_names     jsonb,                             -- array<string>
  cedula_hmac         varchar(64),                       -- HMAC-SHA256 de la cédula (match sin exponer)
  cedula_masked       varchar(15),                       -- "V-****5821"
  age_range           jsonb,                             -- {"min":30,"max":40} — nunca edad exacta
  sex                 varchar(10) check (sex is null or sex in ('M', 'F', 'unknown')),
  is_minor            boolean,                           -- true si < 18; null = desconocido
  last_known_location jsonb,                             -- location_object
  status              varchar(30) not null
                        check (status in ('missing', 'found', 'injured', 'deceased', 'unknown')),
  verification_status varchar(30) not null
                        check (verification_status in ('unverified', 'pending', 'verified', 'conflicting')),
  confidence_score    numeric(4,3) not null default 0.000
                        check (confidence_score >= 0 and confidence_score <= 1),
  source_url          text
);

create index persons_event_id_idx   on public.persons (event_id);
create index persons_status_idx      on public.persons (status);
create index persons_cedula_hmac_idx on public.persons (cedula_hmac);  -- lookup de dedup

-- ----------------------------------------------------------------------------
-- person_notes — hechos sobre una persona; una sola tabla con columnas sparse
--                por tipo (no 4 tablas) para "dame todas las notas de esta persona".
-- ----------------------------------------------------------------------------
create table public.person_notes (
  note_record_id      uuid primary key default gen_random_uuid(),
  person_record_id    uuid not null references public.persons(person_record_id) on delete cascade,
  note_type           varchar(30) not null
                        check (note_type in ('missing', 'injured', 'found', 'deceased')),
  found_by            varchar(300),
  status              varchar(30) not null
                        check (status in ('active', 'superseded', 'retracted')),
  source_date         timestamptz,                       -- cuándo se publicó el hecho
  entry_date          timestamptz not null default now(),-- cuándo entró el registro
  found               boolean,                           -- shorthand; null = desconocido
  last_known_location jsonb,                             -- location_object

  -- sparse: note_type = missing
  last_seen_at         timestamptz,
  last_seen_location   jsonb,

  -- sparse: note_type = injured
  hospital_name        varchar(255),
  hospital_municipio   varchar(100),
  severity             varchar(20)
                         check (severity is null or severity in ('leve', 'moderado', 'grave', 'critico', 'unknown')),
  admitted_time        timestamptz,

  -- sparse: note_type = found
  found_at             timestamptz,

  -- sparse: note_type = deceased
  deceased_at           timestamptz,
  recovery_location     jsonb,                            -- location_object
  identification_status varchar(30)
                          check (identification_status is null or identification_status in ('identified', 'unidentified', 'pending')),
  confirmed_by          varchar(300)
);

create index person_notes_person_record_id_idx on public.person_notes (person_record_id);
create index person_notes_note_type_idx        on public.person_notes (note_type);
create index person_notes_status_idx           on public.person_notes (status);

-- ----------------------------------------------------------------------------
-- person_sources — fuente / corroboración de un dato de persona
--   (se define antes de person_photos porque ésta referencia source_id)
-- ----------------------------------------------------------------------------
create table public.person_sources (
  source_id        uuid primary key default gen_random_uuid(),
  person_record_id uuid not null references public.persons(person_record_id) on delete cascade,
  source_url       text not null,
  ext_id           varchar(255),                         -- id del registro en la fuente externa
  trust_tier       smallint not null
                     check (trust_tier in (1, 2, 3)),    -- 1=oficial · 2=ONG · 3=social/anónimo
  fetched_at       timestamptz not null default now()
);

create index person_sources_person_record_id_idx on public.person_sources (person_record_id);

-- ----------------------------------------------------------------------------
-- person_photos
-- ----------------------------------------------------------------------------
create table public.person_photos (
  photo_id         uuid primary key default gen_random_uuid(),
  person_record_id uuid not null references public.persons(person_record_id) on delete cascade,
  url              text not null,                         -- preferible archivo propio (S3)
  caption          text,
  source_id        uuid references public.person_sources(source_id) on delete set null,
  uploaded_at      timestamptz not null default now()
);

create index person_photos_person_record_id_idx on public.person_photos (person_record_id);
create index person_photos_source_id_idx        on public.person_photos (source_id);

-- ----------------------------------------------------------------------------
-- acopio_centers — centro de acopio asociado a un evento
-- ----------------------------------------------------------------------------
create table public.acopio_centers (
  acopio_id        uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(event_id) on delete cascade,
  name             varchar(300) not null,
  location         jsonb,                                 -- location_object
  confidence_score numeric(4,3) not null default 0.000
                     check (confidence_score >= 0 and confidence_score <= 1),
  status           varchar(30) not null
                     check (status in ('active', 'full', 'closed', 'unverified')),
  -- needs: array<string> de keywords controladas (agua, alimentos, medicamentos,
  -- colchonetas, ropa, calzado, higiene, pañales, leche_formula, generador,
  -- combustible, herramientas, voluntarios, transporte, otro). Enum extensible;
  -- el mapeo texto-libre -> keyword vive en el parser, así que no lo fijamos en un check.
  needs            jsonb,
  last_verified_at timestamptz,
  managing_org     varchar(255),
  contact_hmac     varchar(64),                           -- HMAC del contacto (mismo patrón que cedula_hmac)
  contact_masked   varchar(30),                           -- "+58 412 ***7834"
  capacity         integer,
  current_load     integer
);

create index acopio_centers_event_id_idx on public.acopio_centers (event_id);
create index acopio_centers_status_idx   on public.acopio_centers (status);
