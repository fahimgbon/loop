import type pg from "pg";

export type DbTemplate = {
  id: string;
  slug: string;
  name: string;
  schema_json: unknown;
};

export async function listTemplates(
  client: pg.PoolClient,
  workspaceId: string,
): Promise<Array<{ id: string; slug: string; name: string }>> {
  const res = await client.query<{ id: string; slug: string; name: string }>(
    `select id, slug, name from templates where workspace_id = $1 order by name asc`,
    [workspaceId],
  );
  return res.rows;
}

export async function getTemplateBySlug(
  client: pg.PoolClient,
  workspaceId: string,
  slug: string,
): Promise<DbTemplate | null> {
  const res = await client.query<DbTemplate>(
    `select id, slug, name, schema_json from templates where workspace_id = $1 and slug = $2`,
    [workspaceId, slug],
  );
  return res.rows[0] ?? null;
}

