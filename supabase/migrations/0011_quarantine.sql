-- Quarantine DB — registros no procesables (SPEC-0016, VZLA_DEDUP #88)
--
-- Cuando el pipeline no puede procesar un registro (parser ausente, schema
-- invalido, PII no redactable, etc.) NO se descarta: se preserva aqui, en una
-- capa revisable, con retencion controlada y destruccion auditable. El scraper
-- lo manda via `POST /api/v1/quarantine` (auth x-api-key, ownership de la fuente).
--
-- Como `aportes`/`source_watermarks`: la tabla NO se auto-expone a la Data API;
-- la escritura pasa por el route handler con service_role, que valida que la
-- fuente (source_slug) pertenezca al scraper autenticado. RLS activa + grant
-- solo a service_role. Solo se guarda preview redactado + hash + metadata: nunca
-- PII en claro.

create table public.quarantine_records (
  quarantine_id            uuid primary key default gen_random_uuid(),
  run_id                   uuid,                           -- corrida del pipeline (comparte con aportes)
  source_slug              text not null references public.sources(slug),
  source_url               text,
  reason_code              text not null
                             check (reason_code in (
                               'pii_untreatable',
                               'invalid_schema',
                               'parser_unavailable',
                               'pdf_no_text',
                               'unclassified_sensitive',
                               'contradictory_sources',
                               'ambiguous_manual_review'
                             )),
  reason_detail            text,
  risk_level               text not null
                             check (risk_level in ('low', 'medium', 'high')),
  payload_preview_redacted text,           -- fragmento YA redactado, nunca el payload completo
  payload_hash             varchar(64),    -- sha256 hex puro del payload original
  pii_findings_summary     jsonb,          -- conteos por tipo, nunca valores en claro
  review_status            text not null default 'pending'
                             check (review_status in (
                               'pending',
                               'in_review',
                               'approved_for_staging',
                               'needs_manual_redaction',
                               'rejected',
                               'destroyed'
                             )),
  review_decision          text,
  retention_until          timestamptz,
  destroyed_at             timestamptz,
  created_at               timestamptz not null default now(),
  -- Destruccion auditable: al destruir, el contenido sensible queda en null pero
  -- la fila persiste con destroyed_at + payload_hash para verificar que ese
  -- payload exacto fue visto y destruido deliberadamente.
  constraint quarantine_destroyed_consistency check (
    review_status <> 'destroyed' or (
      destroyed_at is not null
      and payload_hash is not null
      and payload_preview_redacted is null
      and pii_findings_summary is null
    )
  )
);

-- Idempotencia de la ingesta: no re-encolar el mismo payload de la misma fuente.
-- source_slug es unico en sources, asi que queda acotado al dueno de la fuente.
-- El indice unico parcial es el guardia real ante carreras concurrentes.
create unique index quarantine_records_source_payload_unique_idx
  on public.quarantine_records (source_slug, payload_hash)
  where payload_hash is not null;

-- Cola de revision por estado y por motivo.
create index quarantine_records_review_status_idx
  on public.quarantine_records (review_status);
create index quarantine_records_reason_code_idx
  on public.quarantine_records (reason_code);
-- Trazabilidad por corrida (correlacion con aportes del mismo run_id).
create index quarantine_records_run_id_idx
  on public.quarantine_records (run_id);
-- Barrido de retencion: pendientes de destruir cuya retencion ya vencio.
create index quarantine_records_retention_due_idx
  on public.quarantine_records (retention_until)
  where destroyed_at is null;

-- ----------------------------------------------------------------------------
-- RLS + grants (espejo de aportes/source_watermarks: solo service_role)
-- ----------------------------------------------------------------------------
alter table public.quarantine_records enable row level security;

-- El grant masivo de 0003 solo cubria las tablas de entonces; esta tabla nueva
-- va explicita. Sin grant a anon/authenticated: la escritura pasa por el route
-- handler con service_role. La revision humana sera otro spec (UI interna).
grant all privileges on public.quarantine_records to service_role;
