-- Ingestion/consolidation run observability (VZLA_DEDUP#96).
--
-- Workflows live in VZLA_DEDUP. dataVenezuela only stores the run ledger used by
-- the scheduler/dashboard to inspect source freshness and failures.

create table public.ingestion_runs (
  run_id        uuid primary key default gen_random_uuid(),
  source_slug   text references public.sources(slug),
  ci_run_url    text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running'
                  check (status in ('running', 'ok', 'error')),
  records_in    integer,
  records_new   integer,
  records_dup   integer,
  errors        integer not null default 0,
  error_sample  text,
  dedup_version text
);

create index ingestion_runs_source_idx
  on public.ingestion_runs (source_slug, started_at desc);
create index ingestion_runs_status_idx
  on public.ingestion_runs (status);

alter table public.ingestion_runs enable row level security;

create policy ingestion_runs_select_admin on public.ingestion_runs
  for select to authenticated using (public.is_admin());

grant all privileges on public.ingestion_runs to service_role;
grant select on public.ingestion_runs to authenticated;
