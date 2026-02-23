import type pg from "pg";

export type DbGoogleInstallation = {
  id: string;
  workspace_id: string;
  google_user_id: string | null;
  email: string | null;
  hosted_domain: string | null;
  scope: string | null;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  token_expires_at: string | null;
  installed_by: string | null;
  installed_at: string;
  created_at: string;
  updated_at: string;
};

export async function upsertGoogleInstallation(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    googleUserId: string | null;
    email: string | null;
    hostedDomain: string | null;
    scope: string | null;
    accessToken: string;
    refreshToken: string | null;
    tokenType: string | null;
    tokenExpiresAt: Date | null;
    installedBy: string | null;
  },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into google_workspace_installations (
        workspace_id, google_user_id, email, hosted_domain, scope,
        access_token, refresh_token, token_type, token_expires_at,
        installed_by, installed_at
      ) values (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, now()
      )
      on conflict (workspace_id)
      do update set
        google_user_id = excluded.google_user_id,
        email = excluded.email,
        hosted_domain = excluded.hosted_domain,
        scope = excluded.scope,
        access_token = excluded.access_token,
        refresh_token = coalesce(excluded.refresh_token, google_workspace_installations.refresh_token),
        token_type = excluded.token_type,
        token_expires_at = excluded.token_expires_at,
        installed_by = excluded.installed_by,
        installed_at = now(),
        updated_at = now()
      returning id`,
    [
      input.workspaceId,
      input.googleUserId,
      input.email,
      input.hostedDomain,
      input.scope,
      input.accessToken,
      input.refreshToken,
      input.tokenType,
      input.tokenExpiresAt,
      input.installedBy,
    ],
  );
  return res.rows[0];
}

export async function getGoogleInstallationForWorkspace(
  client: pg.PoolClient,
  workspaceId: string,
): Promise<DbGoogleInstallation | null> {
  const res = await client.query<DbGoogleInstallation>(
    `select *
     from google_workspace_installations
     where workspace_id = $1
     order by installed_at desc
     limit 1`,
    [workspaceId],
  );
  return res.rows[0] ?? null;
}

export async function updateGoogleTokens(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    accessToken: string;
    refreshToken?: string | null;
    tokenType?: string | null;
    tokenExpiresAt?: Date | null;
  },
) {
  await client.query(
    `update google_workspace_installations
     set access_token = $1,
         refresh_token = coalesce($2, refresh_token),
         token_type = coalesce($3, token_type),
         token_expires_at = $4,
         updated_at = now()
     where workspace_id = $5`,
    [
      input.accessToken,
      input.refreshToken ?? null,
      input.tokenType ?? null,
      input.tokenExpiresAt ?? null,
      input.workspaceId,
    ],
  );
}
