create table if not exists google_workspace_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  google_user_id text null,
  email text null,
  hosted_domain text null,
  scope text null,
  access_token text not null,
  refresh_token text null,
  token_type text null,
  token_expires_at timestamptz null,
  installed_by uuid references users(id) on delete set null,
  installed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create index if not exists google_workspace_installations_workspace_idx
  on google_workspace_installations (workspace_id, installed_at desc);

alter table workspaces add column if not exists default_google_calendar_id text null;
