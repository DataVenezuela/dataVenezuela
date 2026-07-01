-- Fix: block_keys ausente en schema cache de PostgREST (SPEC-0013 follow-up)
--
-- Causa raíz: la migración 0008 puede no haberse aplicado en producción,
-- o PostgREST no recargó su schema cache después de la migración.
-- Este parche es idempotente: ADD COLUMN IF NOT EXISTS no falla si la columna
-- ya existe, y el NOTIFY fuerza el reload del cache en ambos escenarios.

-- Escenario 1: columna no existe → la crea.
-- Escenario 2: columna existe pero PostgREST no la ve → el NOTIFY resuelve.
alter table public.aportes
  add column if not exists block_keys text[];

-- Forzar reload del schema cache de PostgREST (ambos escenarios).
-- Supabase ejecuta pgrst en modo "db-schema-cache" que escucha este canal.
notify pgrst, 'reload schema';
