-- Raw artifact metadata for replayable, redacted source payloads (VZLA_DEDUP#86).
--
-- The payload itself lives outside Postgres (for example R2). This table is the
-- metadata index and closes the FK from aportes.raw_artifact_id.

create table public.raw_artifacts (
  artifact_id          uuid primary key default gen_random_uuid(),
  run_id               uuid,
  source_slug          text not null references public.sources(slug),
  source_url           text,
  fetched_at           timestamptz not null,
  http_status          smallint,
  content_type         text,
  content_hash         varchar(64) not null unique,
  raw_record_hash      varchar(64),
  r2_url               text not null,
  byte_size            integer,
  parser_version       text,
  pii_status           text not null
                         check (pii_status in ('redacted', 'no_pii_found', 'failed')),
  pii_findings_summary jsonb,
  ingestion_status     text not null default 'pending'
                         check (ingestion_status in ('pending', 'staged', 'failed')),
  created_at           timestamptz not null default now()
);

create index raw_artifacts_source_slug_idx
  on public.raw_artifacts (source_slug, fetched_at desc);
create index raw_artifacts_ingestion_status_idx
  on public.raw_artifacts (ingestion_status);

alter table public.aportes
  add constraint aportes_raw_artifact_id_fkey
  foreign key (raw_artifact_id)
  references public.raw_artifacts(artifact_id)
  on delete set null;

alter table public.raw_artifacts enable row level security;

-- Internal metadata table; route handlers/jobs use service_role.
grant all privileges on public.raw_artifacts to service_role;
