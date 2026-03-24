import type pg from "pg";

export type DbArtifact = {
  id: string;
  workspace_id: string;
  template_id: string | null;
  folder_id: string | null;
  folder_schema_version: number | null;
  title: string;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type DbBlock = {
  id: string;
  artifact_id: string;
  type: string;
  title: string | null;
  content_md: string;
  position: number;
  meta: unknown;
  updated_at: string;
};

export async function getBlock(
  client: pg.PoolClient,
  artifactId: string,
  blockId: string,
): Promise<Pick<DbBlock, "id" | "artifact_id" | "type" | "title" | "position"> | null> {
  const res = await client.query<Pick<DbBlock, "id" | "artifact_id" | "type" | "title" | "position">>(
    `select id, artifact_id, type, title, position
     from artifact_blocks
     where artifact_id = $1 and id = $2`,
    [artifactId, blockId],
  );
  return res.rows[0] ?? null;
}

export async function getBlockWithContent(
  client: pg.PoolClient,
  input: { workspaceId: string; artifactId: string; blockId: string },
): Promise<
  | {
      id: string;
      artifact_id: string;
      type: string;
      title: string | null;
      position: number;
      content_md: string;
    }
  | null
> {
  const res = await client.query<{
    id: string;
    artifact_id: string;
    type: string;
    title: string | null;
    position: number;
    content_md: string;
  }>(
    `select b.id, b.artifact_id, b.type, b.title, b.position, b.content_md
     from artifact_blocks b
     join artifacts a on a.id = b.artifact_id
     where a.workspace_id = $1 and b.artifact_id = $2 and b.id = $3`,
    [input.workspaceId, input.artifactId, input.blockId],
  );
  return res.rows[0] ?? null;
}

export async function listArtifacts(
  client: pg.PoolClient,
  workspaceId: string,
  options?: { limit?: number },
): Promise<Array<Pick<DbArtifact, "id" | "title" | "status" | "updated_at" | "folder_id"> & { folder_name: string | null }>> {
  const limit = Math.max(1, Math.min(options?.limit ?? 100, 200));
  const res = await client.query<
    Pick<DbArtifact, "id" | "title" | "status" | "updated_at" | "folder_id"> & { folder_name: string | null }
  >(
    `select a.id, a.title, a.status, a.updated_at, a.folder_id, f.name as folder_name
     from artifacts a
     left join artifact_folders f on f.id = a.folder_id
     where a.workspace_id = $1
     order by a.updated_at desc
     limit $2`,
    [workspaceId, limit],
  );
  return res.rows;
}

export async function getArtifact(
  client: pg.PoolClient,
  workspaceId: string,
  artifactId: string,
): Promise<DbArtifact | null> {
  const res = await client.query<DbArtifact>(
    `select id, workspace_id, template_id, folder_id, folder_schema_version, title, status, created_at, updated_at
     from artifacts
     where workspace_id = $1 and id = $2`,
    [workspaceId, artifactId],
  );
  return res.rows[0] ?? null;
}

export async function listBlocks(
  client: pg.PoolClient,
  artifactId: string,
): Promise<DbBlock[]> {
  const res = await client.query<DbBlock>(
    `select id, artifact_id, type, title, content_md, position, meta, updated_at
     from artifact_blocks
     where artifact_id = $1
     order by position asc`,
    [artifactId],
  );
  return res.rows;
}

export async function createArtifact(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    templateId: string | null;
    folderId?: string | null;
    folderSchemaVersion?: number | null;
    title: string;
    createdBy: string;
    status?: "draft" | "active";
  },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into artifacts (workspace_id, template_id, folder_id, folder_schema_version, title, status, created_by)
     values ($1, $2, $3, $4, $5, $6::artifact_status, $7)
     returning id`,
    [
      input.workspaceId,
      input.templateId,
      input.folderId ?? null,
      input.folderSchemaVersion ?? null,
      input.title,
      input.status ?? "draft",
      input.createdBy,
    ],
  );
  return res.rows[0];
}

export async function insertBlock(
  client: pg.PoolClient,
  input: {
    artifactId: string;
    type: string;
    title: string | null;
    contentMd: string;
    position: number;
    meta: unknown;
    userId: string;
  },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into artifact_blocks (artifact_id, type, title, content_md, position, meta, created_by, updated_by)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)
     returning id`,
    [
      input.artifactId,
      input.type,
      input.title,
      input.contentMd,
      input.position,
      JSON.stringify(input.meta ?? {}),
      input.userId,
    ],
  );
  return res.rows[0];
}

export async function insertBlockAtPosition(
  client: pg.PoolClient,
  input: {
    artifactId: string;
    type: string;
    title: string | null;
    contentMd: string;
    position: number;
    meta: unknown;
    userId: string;
  },
): Promise<{ id: string }> {
  const target = Math.max(1, input.position);

  // Move tail out of the way to satisfy (artifact_id, position) unique index,
  // then normalize to create exactly one free slot at `target`.
  await client.query(
    `update artifact_blocks
     set position = position + 1000
     where artifact_id = $1 and position >= $2`,
    [input.artifactId, target],
  );

  const inserted = await insertBlock(client, {
    artifactId: input.artifactId,
    type: input.type,
    title: input.title,
    contentMd: input.contentMd,
    position: target,
    meta: input.meta,
    userId: input.userId,
  });

  await client.query(
    `update artifact_blocks
     set position = position - 999
     where artifact_id = $1 and position >= $2`,
    [input.artifactId, target + 1000],
  );

  return inserted;
}

export async function getNextBlockPosition(client: pg.PoolClient, artifactId: string): Promise<number> {
  const res = await client.query<{ next_pos: number }>(
    `select (coalesce(max(position), 0) + 1)::int as next_pos from artifact_blocks where artifact_id = $1`,
    [artifactId],
  );
  return res.rows[0]?.next_pos ?? 1;
}

export async function updateBlockContent(
  client: pg.PoolClient,
  input: { workspaceId: string; blockId: string; contentMd: string; userId: string },
): Promise<void> {
  await client.query(
    `with updated as (
       update artifact_blocks b
       set content_md = $1, updated_by = $2, updated_at = now()
       from artifacts a
       where b.id = $3 and b.artifact_id = a.id and a.workspace_id = $4
       returning b.artifact_id
     )
     update artifacts a
     set updated_at = now()
     from updated u
     where a.id = u.artifact_id`,
    [input.contentMd, input.userId, input.blockId, input.workspaceId],
  );
}

export async function updateArtifactTitle(
  client: pg.PoolClient,
  input: { workspaceId: string; artifactId: string; title: string },
) {
  await client.query(
    `update artifacts set title = $1, updated_at = now() where id = $2 and workspace_id = $3`,
    [input.title, input.artifactId, input.workspaceId],
  );
}

export async function markArtifactFolderSchemaVersion(
  client: pg.PoolClient,
  input: { workspaceId: string; artifactId: string; folderSchemaVersion: number },
) {
  await client.query(
    `update artifacts
     set folder_schema_version = $1,
         updated_at = now()
     where id = $2 and workspace_id = $3`,
    [input.folderSchemaVersion, input.artifactId, input.workspaceId],
  );
}

export async function deleteBlockById(
  client: pg.PoolClient,
  input: { artifactId: string; blockId: string },
) {
  await client.query(`delete from artifact_blocks where artifact_id = $1 and id = $2`, [
    input.artifactId,
    input.blockId,
  ]);
}

export async function normalizeBlockPositions(client: pg.PoolClient, artifactId: string) {
  await client.query(
    `with ordered as (
       select id, row_number() over (order by position asc, created_at asc) as new_position
       from artifact_blocks
       where artifact_id = $1
     )
     update artifact_blocks b
     set position = o.new_position
     from ordered o
     where b.id = o.id`,
    [artifactId],
  );
}

export async function reorderArtifactBlocks(
  client: pg.PoolClient,
  input: { artifactId: string; orderedBlockIds: string[] },
) {
  if (input.orderedBlockIds.length === 0) return;
  const current = await client.query<{ id: string }>(
    `select id
     from artifact_blocks
     where artifact_id = $1
     order by position asc`,
    [input.artifactId],
  );
  const currentIds = current.rows.map((row) => row.id);
  if (currentIds.length !== input.orderedBlockIds.length) {
    throw new Error("Invalid block order payload");
  }
  const currentSet = new Set(currentIds);
  for (const id of input.orderedBlockIds) {
    if (!currentSet.has(id)) throw new Error("Invalid block order payload");
  }

  await client.query(
    `update artifact_blocks
     set position = position + 1000
     where artifact_id = $1`,
    [input.artifactId],
  );

  for (const [index, blockId] of input.orderedBlockIds.entries()) {
    await client.query(
      `update artifact_blocks
       set position = $1, updated_at = now()
       where artifact_id = $2 and id = $3`,
      [index + 1, input.artifactId, blockId],
    );
  }
}

export async function findArtifactByTitle(
  client: pg.PoolClient,
  input: { workspaceId: string; title: string },
): Promise<Pick<DbArtifact, "id" | "title"> | null> {
  const res = await client.query<Pick<DbArtifact, "id" | "title">>(
    `select id, title
     from artifacts
     where workspace_id = $1 and lower(title) = lower($2)
     order by updated_at desc
     limit 1`,
    [input.workspaceId, input.title],
  );
  return res.rows[0] ?? null;
}
