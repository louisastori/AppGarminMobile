begin;

create extension if not exists pgcrypto;

create type provider_type as enum (
  'garmin',
  'ifit'
);

create type source_provider_type as enum (
  'garmin',
  'ifit',
  'manual'
);

create type account_link_status as enum (
  'active',
  'expired',
  'revoked',
  'error'
);

create type device_type as enum (
  'watch',
  'bike_computer',
  'treadmill',
  'smart_trainer',
  'phone',
  'service'
);

create type device_integration_mode as enum (
  'garmin_health_direct',
  'connect_iq_direct',
  'ifit_cloud',
  'manual_import'
);

create type device_association_type as enum (
  'paired_via_platform',
  'paired_directly_with_app',
  'controls',
  'broadcasts_hr_to',
  'used_during_session',
  'syncs_via_phone'
);

create type device_association_status as enum (
  'active',
  'inactive',
  'stale'
);

create type workout_status as enum (
  'draft',
  'ready',
  'merged',
  'conflicted',
  'archived'
);

create type activity_type as enum (
  'indoor_cycling',
  'outdoor_cycling',
  'treadmill_run',
  'indoor_run',
  'run',
  'walk',
  'strength',
  'other'
);

create type reconciliation_state as enum (
  'single_source',
  'merged',
  'pending_review',
  'conflicted',
  'imported_manually'
);

create type session_device_role as enum (
  'primary_recorder',
  'secondary_recorder',
  'heart_rate_source',
  'trainer_controller',
  'controlled_trainer',
  'display_only',
  'imported_context'
);

create type metric_type as enum (
  'heart_rate',
  'power',
  'cadence',
  'speed',
  'resistance',
  'incline'
);

create type conflict_type as enum (
  'duplicate_candidate',
  'inconsistent_primary_device',
  'metric_mismatch',
  'overlapping_sessions',
  'missing_source'
);

create type conflict_severity as enum (
  'low',
  'medium',
  'high'
);

create type conflict_status as enum (
  'open',
  'resolved',
  'ignored'
);

create type sync_job_type as enum (
  'pair_garmin_wearable',
  'sync_garmin_wearable',
  'sync_edge_device_app',
  'sync_ifit_sessions',
  'import_fit_file',
  'import_gpx_file',
  'reconcile_sessions'
);

create type session_acquisition_channel as enum (
  'garmin_health_sdk',
  'connect_iq_app',
  'ifit_cloud',
  'manual_file'
);

create type sync_job_status as enum (
  'queued',
  'running',
  'success',
  'partial_success',
  'failed'
);

create type file_type as enum (
  'fit',
  'gpx'
);

create type file_import_status as enum (
  'uploaded',
  'parsed',
  'failed',
  'linked'
);

create table users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table external_account_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider provider_type not null,
  provider_user_id text not null,
  display_name text,
  status account_link_status not null default 'active',
  sync_cursor jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_user_id)
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  external_account_link_id uuid references external_account_links(id) on delete set null,
  manufacturer text not null,
  model text not null,
  device_family text,
  device_type device_type not null,
  integration_mode device_integration_mode not null default 'manual_import',
  serial_number_hash text,
  external_device_id text,
  protocol_capabilities jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index devices_unique_external_identity
  on devices (user_id, external_account_link_id, external_device_id)
  where external_device_id is not null;

create table device_associations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source_device_id uuid not null references devices(id) on delete cascade,
  target_device_id uuid not null references devices(id) on delete cascade,
  association_type device_association_type not null,
  status device_association_status not null default 'active',
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  check (source_device_id <> target_device_id)
);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  canonical_source_provider source_provider_type not null,
  activity_type activity_type not null,
  sport_family text,
  title text,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  distance_meters numeric(12,2),
  elevation_gain_meters numeric(12,2),
  energy_kcal integer,
  avg_heart_rate integer,
  max_heart_rate integer,
  avg_power_watts numeric(10,2),
  avg_speed_mps numeric(10,4),
  primary_device_id uuid references devices(id) on delete set null,
  status workout_status not null default 'ready',
  reconciliation_state reconciliation_state not null default 'single_source',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_sessions_user_started_at_idx
  on workout_sessions (user_id, started_at desc);

create index workout_sessions_primary_device_idx
  on workout_sessions (primary_device_id);

create table session_sources (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  external_account_link_id uuid references external_account_links(id) on delete set null,
  provider provider_type not null,
  acquisition_channel session_acquisition_channel not null default 'manual_file',
  provider_session_id text not null,
  provider_payload_ref text,
  provider_payload jsonb,
  provider_started_at timestamptz,
  provider_duration_seconds integer,
  provider_distance_meters numeric(12,2),
  provider_device_name text,
  ingested_at timestamptz not null default now(),
  is_primary_candidate boolean not null default false,
  unique (provider, provider_session_id)
);

create index session_sources_workout_session_id_idx
  on session_sources (workout_session_id);

create table session_device_roles (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  role session_device_role not null,
  is_primary boolean not null default false,
  source_confidence numeric(5,4) not null default 0.5000,
  created_at timestamptz not null default now(),
  check (source_confidence >= 0 and source_confidence <= 1)
);

create unique index session_device_roles_single_primary_idx
  on session_device_roles (workout_session_id)
  where is_primary = true;

create index session_device_roles_device_idx
  on session_device_roles (device_id);

create table sensor_streams (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  device_id uuid references devices(id) on delete set null,
  metric_type metric_type not null,
  sample_rate_hint numeric(10,4),
  summary_min numeric(12,4),
  summary_max numeric(12,4),
  summary_avg numeric(12,4),
  stream_ref text,
  created_at timestamptz not null default now()
);

create index sensor_streams_session_metric_idx
  on sensor_streams (workout_session_id, metric_type);

create table session_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workout_session_id uuid references workout_sessions(id) on delete cascade,
  conflict_type conflict_type not null,
  severity conflict_severity not null default 'medium',
  status conflict_status not null default 'open',
  details jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index session_conflicts_user_status_idx
  on session_conflicts (user_id, status, detected_at desc);

create table sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  external_account_link_id uuid references external_account_links(id) on delete cascade,
  device_id uuid references devices(id) on delete set null,
  job_type sync_job_type not null,
  status sync_job_status not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  cursor_before jsonb not null default '{}'::jsonb,
  cursor_after jsonb not null default '{}'::jsonb,
  items_seen integer not null default 0,
  items_created integer not null default 0,
  items_updated integer not null default 0,
  items_merged integer not null default 0,
  items_conflicted integer not null default 0,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index sync_jobs_user_created_at_idx
  on sync_jobs (user_id, created_at desc);

create table file_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  file_name text not null,
  file_hash_sha256 text not null,
  file_type file_type not null,
  imported_at timestamptz not null default now(),
  parsed_at timestamptz,
  status file_import_status not null default 'uploaded',
  parser_summary jsonb not null default '{}'::jsonb,
  workout_session_id uuid references workout_sessions(id) on delete set null,
  unique (user_id, file_hash_sha256)
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on users
for each row execute function set_updated_at();

create trigger external_account_links_set_updated_at
before update on external_account_links
for each row execute function set_updated_at();

create trigger devices_set_updated_at
before update on devices
for each row execute function set_updated_at();

create trigger workout_sessions_set_updated_at
before update on workout_sessions
for each row execute function set_updated_at();

commit;
