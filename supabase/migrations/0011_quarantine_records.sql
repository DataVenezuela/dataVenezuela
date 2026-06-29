-- Quarantine records for unprocessable scraper payloads (VZLA_DEDUP#88).
--
-- The pipeline can preserve records that cannot safely reach staging instead of
-- dropping them. Payloads here must already be redacted; raw PII is not allowed.

create table public.quarantine_records (
  quarantine_id            uuid primary key default gen_random_uuid(),
  run_id                   uuid,
  source_slug              text not null references public.sources(slug),
  source_url               text,
  reason_code              text not null,
  reason_detail            text,
  risk_level               text not null check (risk_level in ('low', 'medium', 'high')),
  payload_preview_redacted text,
  payload_hash             varchar(64),
  pii_findings_summary     jsonb,
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
  created_at               timestamptz not null default now()
);

create index quarantine_records_source_slug_idx
  on public.quarantine_records (source_slug, created_at desc);
create index quarantine_records_review_status_idx
  on public.quarantine_records (review_status);
create index quarantine_records_risk_level_idx
  on public.quarantine_records (risk_level);

alter table public.quarantine_records enable row level security;

-- Internal table: route handlers write with service_role after x-api-key auth.
grant all privileges on public.quarantine_records to service_role;
