create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_role') then
    create type workspace_role as enum ('admin', 'member');
  end if;

  if not exists (select 1 from pg_type where typname = 'artifact_status') then
    create type artifact_status as enum ('draft', 'active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'contribution_source') then
    create type contribution_source as enum ('web_audio', 'web_text', 'slack', 'meeting');
  end if;

  if not exists (select 1 from pg_type where typname = 'contribution_intent') then
    create type contribution_intent as enum ('idea', 'feedback', 'risk', 'assumption', 'question', 'unknown');
  end if;

  if not exists (select 1 from pg_type where typname = 'review_request_status') then
    create type review_request_status as enum ('open', 'closed');
  end if;

  if not exists (select 1 from pg_type where typname = 'feedback_type') then
    create type feedback_type as enum ('concern', 'support', 'question', 'risk', 'suggestion', 'note');
  end if;

  if not exists (select 1 from pg_type where typname = 'feedback_status') then
    create type feedback_status as enum ('open', 'accepted', 'rejected', 'resolved');
  end if;

  if not exists (select 1 from pg_type where typname = 'feedback_severity') then
    create type feedback_severity as enum ('low', 'medium', 'high', 'critical');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('queued', 'running', 'succeeded', 'failed');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_email_uq on users (lower(email));

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_memberships (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  schema_json jsonb not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  template_id uuid references templates(id) on delete set null,
  title text not null,
  status artifact_status not null default 'draft',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artifacts_workspace_idx on artifacts (workspace_id);

create table if not exists artifact_blocks (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  type text not null,
  title text null,
  content_md text not null default '',
  position integer not null,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artifact_blocks_artifact_idx on artifact_blocks (artifact_id);
create unique index if not exists artifact_blocks_artifact_position_uq on artifact_blocks (artifact_id, position);

create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  artifact_id uuid references artifacts(id) on delete set null,
  block_id uuid references artifact_blocks(id) on delete set null,
  source contribution_source not null,
  source_ref text null,
  audio_path text null,
  text_content text null,
  transcript text null,
  intent contribution_intent not null default 'unknown',
  intent_confidence real null,
  extracted_json jsonb null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contributions_workspace_idx on contributions (workspace_id, created_at desc);

create table if not exists review_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  artifact_id uuid not null references artifacts(id) on delete cascade,
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  due_at timestamptz null,
  slack_channel_id text null,
  slack_message_ts text null,
  created_by uuid references users(id) on delete set null,
  status review_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_requests_artifact_idx on review_requests (artifact_id, created_at desc);

create table if not exists review_request_targets (
  review_request_id uuid not null references review_requests(id) on delete cascade,
  block_id uuid not null references artifact_blocks(id) on delete cascade,
  primary key (review_request_id, block_id)
);

create table if not exists review_responses (
  id uuid primary key default gen_random_uuid(),
  review_request_id uuid not null references review_requests(id) on delete cascade,
  contribution_id uuid not null references contributions(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists review_responses_request_idx on review_responses (review_request_id, created_at desc);

create table if not exists feedback_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  artifact_id uuid not null references artifacts(id) on delete cascade,
  block_id uuid references artifact_blocks(id) on delete set null,
  type feedback_type not null,
  severity feedback_severity not null default 'low',
  status feedback_status not null default 'open',
  summary text not null,
  detail_md text not null default '',
  created_by uuid references users(id) on delete set null,
  created_from_contribution_id uuid references contributions(id) on delete set null,
  resolved_by uuid references users(id) on delete set null,
  resolution_note_md text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists feedback_items_artifact_idx on feedback_items (artifact_id, status);

create table if not exists slack_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slack_team_id text not null,
  slack_team_name text null,
  slack_enterprise_id text null,
  bot_user_id text not null,
  bot_token text not null,
  installed_by uuid references users(id) on delete set null,
  installed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slack_team_id)
);

create index if not exists slack_installations_team_idx on slack_installations (slack_team_id);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  status job_status not null default 'queued',
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_queue_idx on jobs (status, run_at);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  title text not null,
  start_at timestamptz null,
  end_at timestamptz null,
  minutes_md text null,
  transcript text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_event_id)
);

create table if not exists notion_publications (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  notion_page_id text not null,
  last_published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artifact_id)
);

