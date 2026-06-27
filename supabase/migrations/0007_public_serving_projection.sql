-- Proyeccion publica para el plano Worker/D1.
--
-- Estas vistas son la fuente del job de publicacion Supabase -> D1/SQLite.
-- No son endpoints publicos de Supabase: solo service_role puede leerlas.
-- El Worker decide que columnas salen por HTTP segun docs/openapi-public-serving.json.

create or replace view public.public_serving_events
with (security_invoker = true)
as
select
  event_id,
  name,
  event_type,
  occurred_at,
  affected_states,
  magnitude,
  depth_km,
  status,
  external_ids
from public.events;

create or replace view public.public_serving_persons
with (security_invoker = true)
as
select
  person_record_id,
  event_id,
  full_name,
  alternate_names,
  cedula_hmac,
  cedula_masked,
  age_range,
  sex,
  last_known_location,
  status,
  verification_status,
  confidence_score,
  source_url
from public.persons;

create or replace view public.public_serving_acopio_centers
with (security_invoker = true)
as
select
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
from public.acopio_centers;

comment on view public.public_serving_events is
  'Eventos sanitizados para materializar el artefacto publico Worker/D1.';
comment on view public.public_serving_persons is
  'Personas sanitizadas para materializar el artefacto publico Worker/D1. cedula_hmac existe solo para lookup interno del artefacto, no para respuestas HTTP.';
comment on view public.public_serving_acopio_centers is
  'Centros de acopio sanitizados para materializar el artefacto publico Worker/D1.';

revoke all on
  public.public_serving_events,
  public.public_serving_persons,
  public.public_serving_acopio_centers
from anon, authenticated;

grant select on
  public.public_serving_events,
  public.public_serving_persons,
  public.public_serving_acopio_centers
to service_role;
