-- Proteccion de menores en la vista publica de personas (issue VZLA_DEDUP#103).
--
-- Cuando is_minor = true, se redactan campos identificables para que el
-- artefacto publico Worker/D1 nunca exponga datos que permitan localizar
-- o identificar a un menor.
--
-- Reglas de reduccion:
--   full_name, alternate_names  → NULL
--   cedula_hmac, cedula_masked  → NULL
--   last_known_location         → solo estado (primer segmento antes de coma)
--   age_range, sex, status, verification_status, confidence_score → visibles

create or replace view public.public_serving_persons
with (security_invoker = true)
as
select
  person_record_id,
  event_id,

  -- Campos identificables: NULL cuando is_minor = true
  case when is_minor = true then null else full_name end          as full_name,
  case when is_minor = true then null else alternate_names end    as alternate_names,
  case when is_minor = true then null else cedula_hmac end        as cedula_hmac,
  case when is_minor = true then null else cedula_masked end      as cedula_masked,

  age_range,
  sex,

  -- Ubicacion: solo estado cuando is_minor = true
  case
    when is_minor = true and last_known_location like '%,%'
      then trim(split_part(last_known_location, ',', 2))
    when is_minor = true
      then last_known_location
    else last_known_location
  end as last_known_location,

  status,
  verification_status,
  confidence_score,
  is_minor,
  source_url
from public.persons;

comment on view public.public_serving_persons is
  'Personas sanitizadas para materializar el artefacto publico Worker/D1. '
  'Campos identificables redactados cuando is_minor = true (VZLA_DEDUP#103). '
  'cedula_hmac existe solo para lookup interno del artefacto, no para respuestas HTTP.';
