import type pg from "pg";

export type DbArtifactFolder = {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  schema_json: unknown;
  structure_version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function listFolders(
  client: pg.PoolClient,
  workspaceId: string,
): Promise<Array<Pick<DbArtifactFolder, "id" | "slug" | "name" | "structure_version" | "updated_at">>> {
  const res = await client.query<
    Pick<DbArtifactFolder, "id" | "slug" | "name" | "structure_version" | "updated_at">
  >(
    `select id, slug, name, structure_version, updated_at
     from artifact_folders
     where workspace_id = $1
     order by lower(name) asc`,
    [workspaceId],
  );
  return res.rows;
}

export async function getFolder(
  client: pg.PoolClient,
  workspaceId: string,
  folderId: string,
): Promise<DbArtifactFolder | null> {
  const res = await client.query<DbArtifactFolder>(
    `select id, workspace_id, slug, name, schema_json, structure_version, created_by, created_at, updated_at
     from artifact_folders
     where workspace_id = $1 and id = $2`,
    [workspaceId, folderId],
  );
  return res.rows[0] ?? null;
}

export async function getFolderBySlug(
  client: pg.PoolClient,
  workspaceId: string,
  slug: string,
): Promise<DbArtifactFolder | null> {
  const res = await client.query<DbArtifactFolder>(
    `select id, workspace_id, slug, name, schema_json, structure_version, created_by, created_at, updated_at
     from artifact_folders
     where workspace_id = $1 and slug = $2`,
    [workspaceId, slug],
  );
  return res.rows[0] ?? null;
}

export async function createFolder(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    slug: string;
    name: string;
    schemaJson: unknown;
    createdBy: string;
  },
): Promise<{ id: string; structure_version: number }> {
  const res = await client.query<{ id: string; structure_version: number }>(
    `insert into artifact_folders (workspace_id, slug, name, schema_json, created_by)
     values ($1, $2, $3, $4::jsonb, $5)
     returning id, structure_version`,
    [input.workspaceId, input.slug, input.name, JSON.stringify(input.schemaJson), input.createdBy],
  );
  return res.rows[0];
}

export async function upsertFolderBySlug(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    slug: string;
    name: string;
    schemaJson: unknown;
    createdBy: string;
  },
): Promise<{ id: string; structure_version: number }> {
  const res = await client.query<{ id: string; structure_version: number }>(
    `insert into artifact_folders (workspace_id, slug, name, schema_json, created_by)
     values ($1, $2, $3, $4::jsonb, $5)
     on conflict (workspace_id, slug)
     do update set
       name = excluded.name,
       schema_json = excluded.schema_json,
       structure_version = case
         when artifact_folders.name is distinct from excluded.name
           or artifact_folders.schema_json is distinct from excluded.schema_json
         then artifact_folders.structure_version + 1
         else artifact_folders.structure_version
       end,
       updated_at = now()
     returning id, structure_version`,
    [input.workspaceId, input.slug, input.name, JSON.stringify(input.schemaJson), input.createdBy],
  );
  return res.rows[0];
}

export async function updateFolder(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    folderId: string;
    name: string;
    schemaJson: unknown;
  },
): Promise<{ structure_version: number }> {
  const res = await client.query<{ structure_version: number }>(
    `update artifact_folders
     set name = $1,
         schema_json = $2::jsonb,
         structure_version = structure_version + 1,
         updated_at = now()
     where workspace_id = $3 and id = $4
     returning structure_version`,
    [input.name, JSON.stringify(input.schemaJson), input.workspaceId, input.folderId],
  );
  return res.rows[0];
}

export async function listArtifactsForFolder(
  client: pg.PoolClient,
  workspaceId: string,
  folderId: string,
): Promise<Array<{ id: string; title: string; updated_at: string; folder_schema_version: number | null }>> {
  const res = await client.query<{
    id: string;
    title: string;
    updated_at: string;
    folder_schema_version: number | null;
  }>(
    `select id, title, updated_at, folder_schema_version
     from artifacts
     where workspace_id = $1 and folder_id = $2
     order by updated_at desc`,
    [workspaceId, folderId],
  );
  return res.rows;
}

export async function listArtifactsNeedingFolderSync(
  client: pg.PoolClient,
  workspaceId: string,
  folderId: string,
  folderStructureVersion: number,
): Promise<Array<{ id: string; title: string }>> {
  const res = await client.query<{ id: string; title: string }>(
    `select id, title
     from artifacts
     where workspace_id = $1
       and folder_id = $2
       and coalesce(folder_schema_version, 0) < $3
     order by updated_at desc`,
    [workspaceId, folderId, folderStructureVersion],
  );
  return res.rows;
}
