import type pg from "pg";

export type ArtifactPermissionRole = "viewer" | "editor";

export type DbArtifactPermission = {
  artifact_id: string;
  user_id: string;
  role: ArtifactPermissionRole;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function listArtifactPermissions(
  client: pg.PoolClient,
  input: { workspaceId: string; artifactId: string },
): Promise<
  Array<
    Pick<DbArtifactPermission, "user_id" | "role" | "updated_at"> & {
      name: string;
      email: string;
      granted_by_name: string | null;
    }
  >
> {
  try {
    const res = await client.query<
    Pick<DbArtifactPermission, "user_id" | "role" | "updated_at"> & {
      name: string;
      email: string;
      granted_by_name: string | null;
    }
  >(
    `select
       p.user_id,
       p.role,
       p.updated_at,
       u.name,
       u.email,
       g.name as granted_by_name
     from artifact_permissions p
     join artifacts a on a.id = p.artifact_id
     join users u on u.id = p.user_id
     left join users g on g.id = p.granted_by
     where a.workspace_id = $1 and p.artifact_id = $2
     order by lower(u.name) asc, lower(u.email) asc`,
    [input.workspaceId, input.artifactId],
  );
    return res.rows;
  } catch (err) {
    if ((err as { code?: string })?.code === "42P01") return [];
    throw err;
  }
}

export async function upsertArtifactPermission(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    artifactId: string;
    userId: string;
    role: ArtifactPermissionRole;
    grantedBy: string | null;
  },
): Promise<boolean> {
  try {
    const res = await client.query(
      `insert into artifact_permissions (artifact_id, user_id, role, granted_by)
       select $1, $2, $3::artifact_permission_role, $4
       from artifacts a
       join workspace_memberships m
         on m.workspace_id = a.workspace_id and m.user_id = $2
       where a.id = $1 and a.workspace_id = $5
       on conflict (artifact_id, user_id)
       do update set
         role = excluded.role,
         granted_by = excluded.granted_by,
         updated_at = now()
       returning artifact_id`,
      [input.artifactId, input.userId, input.role, input.grantedBy, input.workspaceId],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    if ((err as { code?: string })?.code === "42P01") {
      throw new Error("Database is missing artifact permissions tables. Run npm run db:migrate.");
    }
    throw err;
  }
}

export async function deleteArtifactPermission(
  client: pg.PoolClient,
  input: { workspaceId: string; artifactId: string; userId: string },
) {
  try {
    await client.query(
      `delete from artifact_permissions p
       using artifacts a
       where p.artifact_id = a.id
         and a.workspace_id = $1
         and p.artifact_id = $2
         and p.user_id = $3`,
      [input.workspaceId, input.artifactId, input.userId],
    );
  } catch (err) {
    if ((err as { code?: string })?.code === "42P01") {
      throw new Error("Database is missing artifact permissions tables. Run npm run db:migrate.");
    }
    throw err;
  }
}
