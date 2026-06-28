-- Test: proteccion de menores en public_serving_persons (VZLA_DEDUP#103).
-- Ejecutar contra la base de datos despues de aplicar migraciones.
-- Verifica que la vista redacta PII para menores y los preserva para adultos.

begin;

-- Insertar evento de prueba
insert into public.events (event_id, name, event_type, occurred_at, status)
values ('00000000-0000-0000-0000-000000000001', 'test-event', 'earthquake', now(), 'active');

-- Insertar persona menor de edad
insert into public.persons (
  person_record_id, event_id, full_name, alternate_names,
  cedula_hmac, cedula_masked, age_range, sex, is_minor,
  last_known_location, status, verification_status, confidence_score, source_url
) values (
  '00000000-0000-0000-0000-100000000001',
  '00000000-0000-0000-0000-000000000001',
  'Menor De Prueba',
  '["alias1"]'::jsonb,
  'abc123hmac',
  'V-***-001',
  '{"min":10,"max":14}'::jsonb,
  'M',
  true,
  '{"estado":"Miranda","municipio":"Sucre","parroquia":"Petare"}'::jsonb,
  'missing',
  'unverified',
  0.800,
  'https://example.com/source1'
);

-- Insertar persona adulta
insert into public.persons (
  person_record_id, event_id, full_name, alternate_names,
  cedula_hmac, cedula_masked, age_range, sex, is_minor,
  last_known_location, status, verification_status, confidence_score, source_url
) values (
  '00000000-0000-0000-0000-100000000002',
  '00000000-0000-0000-0000-000000000001',
  'Adulto De Prueba',
  '["alias2"]'::jsonb,
  'def456hmac',
  'V-123-456',
  '{"min":30,"max":40}'::jsonb,
  'F',
  false,
  '{"estado":"Zulia","municipio":"Maracaibo","parroquia":"Centro"}'::jsonb,
  'found',
  'verified',
  0.950,
  'https://example.com/source2'
);

-- ===== Verificaciones para MENOR =====
do $$
declare
  r record;
begin
  select * into r
  from public.public_serving_persons
  where person_record_id = '00000000-0000-0000-0000-100000000001';

  -- Campos identificables deben ser NULL
  assert r.full_name is null,
    'FAIL: full_name debe ser NULL para menor';
  assert r.alternate_names is null,
    'FAIL: alternate_names debe ser NULL para menor';
  assert r.cedula_hmac is null,
    'FAIL: cedula_hmac debe ser NULL para menor';
  assert r.cedula_masked is null,
    'FAIL: cedula_masked debe ser NULL para menor';

  -- Ubicacion debe tener solo estado
  assert r.last_known_location = '{"estado":"Miranda"}'::jsonb,
    'FAIL: last_known_location debe contener solo estado para menor, got: ' || r.last_known_location::text;

  -- Campos no identificables deben estar presentes
  assert r.age_range is not null,
    'FAIL: age_range debe estar presente para menor';
  assert r.sex = 'M',
    'FAIL: sex debe estar presente para menor';
  assert r.status = 'missing',
    'FAIL: status debe estar presente para menor';

  raise notice 'OK: menor redactado correctamente';
end $$;

-- ===== Verificaciones para ADULTO =====
do $$
declare
  r record;
begin
  select * into r
  from public.public_serving_persons
  where person_record_id = '00000000-0000-0000-0000-100000000002';

  -- Campos identificables deben estar presentes
  assert r.full_name = 'Adulto De Prueba',
    'FAIL: full_name debe estar presente para adulto';
  assert r.alternate_names is not null,
    'FAIL: alternate_names debe estar presente para adulto';
  assert r.cedula_hmac = 'def456hmac',
    'FAIL: cedula_hmac debe estar presente para adulto';
  assert r.cedula_masked = 'V-123-456',
    'FAIL: cedula_masked debe estar presente para adulto';

  -- Ubicacion completa para adultos
  assert r.last_known_location ? 'municipio',
    'FAIL: last_known_location debe contener municipio para adulto';
  assert r.last_known_location ? 'parroquia',
    'FAIL: last_known_location debe contener parroquia para adulto';

  raise notice 'OK: adulto sin redaccion';
end $$;

-- ===== Verificar que is_minor NO es columna de la vista =====
do $$
declare
  col_exists boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_serving_persons'
      and column_name = 'is_minor'
  ) into col_exists;

  assert col_exists = false,
    'FAIL: is_minor NO debe ser columna de la vista publica';

  raise notice 'OK: is_minor no expuesto en la vista';
end $$;

rollback;
