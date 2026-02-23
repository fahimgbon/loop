create table if not exists artifact_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  schema_json jsonb not null,
  structure_version integer not null default 1,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index if not exists artifact_folders_workspace_idx on artifact_folders (workspace_id, updated_at desc);

alter table artifacts add column if not exists folder_id uuid references artifact_folders(id) on delete set null;
alter table artifacts add column if not exists folder_schema_version integer null;

create index if not exists artifacts_folder_idx on artifacts (folder_id, updated_at desc);
