do $$
begin
  if not exists (select 1 from pg_type where typname = 'artifact_permission_role') then
    create type artifact_permission_role as enum ('viewer', 'editor');
  end if;

  if not exists (select 1 from pg_type where typname = 'announcement_source') then
    create type announcement_source as enum (
      'manual',
      'announcement',
      'google_classroom',
      'google_form',
      'google_meet',
      'slack'
    );
  end if;
end $$;

create table if not exists artifact_permissions (
  artifact_id uuid not null references artifacts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role artifact_permission_role not null default 'viewer',
  granted_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (artifact_id, user_id)
);

create index if not exists artifact_permissions_user_idx on artifact_permissions (user_id, updated_at desc);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  body_md text not null default '',
  source announcement_source not null default 'manual',
  source_ref text null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists announcements_workspace_idx on announcements (workspace_id, created_at desc);
