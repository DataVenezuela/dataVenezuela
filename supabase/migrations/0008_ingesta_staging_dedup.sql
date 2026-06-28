-- Ingesta de staging para dedup cross-source (SPEC-0013)
--
-- El pipeline VZLA_DEDUP deja de escribir JSONL en disco: ahora ingiere vía
-- `POST /api/aportes`. Para deduplicar ENTRE fuentes (no solo dentro de una), el
-- exporter manda claves de dedup junto a cada registro y lleva un watermark por
-- fuente para no re-procesar lo ya enviado. Aquí construimos el lado dataVenezuela:
--   * 12 columnas nuevas en `aportes` (las llena el exporter, salvo `consolidated_at`,
--     que la pondrá el proceso de consolidación, fuera de este spec).
--   * índices de soporte para consolidación (pendientes / block_keys / run).
--   * tabla `source_watermarks` con su RLS + grants (no se auto-expone).

-- ----------------------------------------------------------------------------
-- aportes: columnas de staging para dedup (todas nullable, compat hacia atrás)
-- ----------------------------------------------------------------------------
alter table public.aportes
  add column run_id             uuid,         -- corrida del pipeline que produjo la fila
  add column entity_type        text,         -- event | acopio | person
  add column dedup_hash         varchar(64),  -- fingerprint de identidad (cross-source)
  add column dedup_version      text,         -- versión del algoritmo de dedup
  add column block_keys         text[],       -- claves de bloqueo para agrupar candidatos
  add column content_hash       varchar(64),  -- hash del contenido normalizado
  add column consolidated_at    timestamptz,  -- la escribe la consolidación (otro spec)
  add column source_record_id   text,         -- id del registro en la fuente original
  add column source_url         text,         -- URL del registro en la fuente
  add column parser_version     text,         -- versión del parser de la fuente
  add column normalizer_version text,         -- versión del normalizador
  add column raw_artifact_id    uuid;         -- artefacto crudo del que deriva la fila

-- Consolidación: barrer pendientes (consolidated_at IS NULL) por tipo de entidad.
create index aportes_pending_idx
  on public.aportes (entity_type) where consolidated_at is null;
-- Agrupar candidatos por clave de bloqueo (búsqueda por contención en el arreglo).
create index aportes_block_keys_idx
  on public.aportes using gin (block_keys);
-- Trazabilidad e idempotencia por corrida.
create index aportes_run_id_idx
  on public.aportes (run_id);

-- ----------------------------------------------------------------------------
-- source_watermarks: marca por fuente del último registro procesado
-- ----------------------------------------------------------------------------
create table public.source_watermarks (
  source_slug  text primary key
                 references public.sources(slug) on delete cascade,
  watermark_at timestamptz not null default '1970-01-01T00:00:00Z',
  updated_at   timestamptz not null default now()
);

create trigger source_watermarks_set_updated_at
  before update on public.source_watermarks
  for each row execute function public.set_updated_at();

-- RLS + grants espejo de `aportes` (ver 0002 y 0003): la lectura/escritura del
-- watermark pasa por el route handler con service_role, que valida ownership en
-- código (mismo patrón que createAporte). No se expone a anon/authenticated.
alter table public.source_watermarks enable row level security;

-- service_role: acceso total (bypassa RLS). El grant masivo de 0003 solo cubre las
-- tablas que existían entonces, así que el de esta tabla nueva va explícito.
grant all privileges on public.source_watermarks to service_role;
