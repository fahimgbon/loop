import type pg from "pg";

export type DbWorkspace = {
  id: string;
  slug: string;
  name: string;
  default_slack_channel_id?: string | null;
  default_google_calendar_id?: string | null;
};

export type WorkspaceMember = {
  user_id: string;
  role: "admin" | "member";
  name: string;
  email: string;
};

export async function getWorkspaceBySlug(
  client: pg.PoolClient,
  slug: string,
): Promise<DbWorkspace | null> {
  const res = await client.query<DbWorkspace>(
    `select id, slug, name, default_slack_channel_id, default_google_calendar_id from workspaces where slug = $1`,
    [slug],
  );
  return res.rows[0] ?? null;
}

export async function getWorkspaceById(
  client: pg.PoolClient,
  workspaceId: string,
): Promise<DbWorkspace | null> {
  const res = await client.query<DbWorkspace>(
    `select id, slug, name, default_slack_channel_id, default_google_calendar_id from workspaces where id = $1`,
    [workspaceId],
  );
  return res.rows[0] ?? null;
}

export async function createWorkspace(
  client: pg.PoolClient,
  input: { slug: string; name: string },
): Promise<{ id: string; slug: string }> {
  const res = await client.query<{ id: string; slug: string }>(
    `insert into workspaces (slug, name) values ($1, $2) returning id, slug`,
    [input.slug, input.name],
  );
  return res.rows[0];
}

export async function setWorkspaceDefaultSlackChannel(
  client: pg.PoolClient,
  input: { workspaceId: string; channelId: string | null },
) {
  await client.query(
    `update workspaces set default_slack_channel_id = $1, updated_at = now() where id = $2`,
    [input.channelId, input.workspaceId],
  );
}

export async function setWorkspaceDefaultGoogleCalendar(
  client: pg.PoolClient,
  input: { workspaceId: string; calendarId: string | null },
) {
  await client.query(
    `update workspaces set default_google_calendar_id = $1, updated_at = now() where id = $2`,
    [input.calendarId, input.workspaceId],
  );
}

export async function upsertMembership(
  client: pg.PoolClient,
  input: { workspaceId: string; userId: string; role: "admin" | "member" },
) {
  await client.query(
    `insert into workspace_memberships (workspace_id, user_id, role)
     values ($1, $2, $3::workspace_role)
     on conflict (workspace_id, user_id)
     do update set role = excluded.role`,
    [input.workspaceId, input.userId, input.role],
  );
}

export async function getFirstWorkspaceForUser(
  client: pg.PoolClient,
  userId: string,
): Promise<{ workspaceId: string; workspaceSlug: string; role: "admin" | "member" } | null> {
  const res = await client.query<{
    workspace_id: string;
    workspace_slug: string;
    role: "admin" | "member";
  }>(
    `select w.id as workspace_id, w.slug as workspace_slug, m.role as role
     from workspace_memberships m
     join workspaces w on w.id = m.workspace_id
     where m.user_id = $1
     order by w.created_at asc
     limit 1`,
    [userId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return { workspaceId: row.workspace_id, workspaceSlug: row.workspace_slug, role: row.role };
}

export async function listWorkspaceMembers(
  client: pg.PoolClient,
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const res = await client.query<WorkspaceMember>(
    `select
       m.user_id,
       m.role,
       u.name,
       u.email
     from workspace_memberships m
     join users u on u.id = m.user_id
     where m.workspace_id = $1
     order by lower(u.name) asc, lower(u.email) asc`,
    [workspaceId],
  );
  return res.rows;
}
