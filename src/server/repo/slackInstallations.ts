import type pg from "pg";

export type DbSlackInstallation = {
  id: string;
  workspace_id: string;
  slack_team_id: string;
  slack_team_name: string | null;
  slack_enterprise_id: string | null;
  bot_user_id: string;
  bot_token: string;
  installed_by: string | null;
  installed_at: string;
  created_at: string;
  updated_at: string;
};

export async function upsertSlackInstallation(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    slackTeamId: string;
    slackTeamName: string | null;
    slackEnterpriseId: string | null;
    botUserId: string;
    botToken: string;
    installedBy: string | null;
  },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into slack_installations (
        workspace_id, slack_team_id, slack_team_name, slack_enterprise_id,
        bot_user_id, bot_token, installed_by, installed_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, now()
      )
      on conflict (workspace_id, slack_team_id)
      do update set
        slack_team_name = excluded.slack_team_name,
        slack_enterprise_id = excluded.slack_enterprise_id,
        bot_user_id = excluded.bot_user_id,
        bot_token = excluded.bot_token,
        installed_by = excluded.installed_by,
        installed_at = now(),
        updated_at = now()
      returning id`,
    [
      input.workspaceId,
      input.slackTeamId,
      input.slackTeamName,
      input.slackEnterpriseId,
      input.botUserId,
      input.botToken,
      input.installedBy,
    ],
  );
  return res.rows[0];
}

export async function getSlackInstallationForWorkspace(
  client: pg.PoolClient,
  workspaceId: string,
): Promise<DbSlackInstallation | null> {
  const res = await client.query<DbSlackInstallation>(
    `select *
     from slack_installations
     where workspace_id = $1
     order by installed_at desc
     limit 1`,
    [workspaceId],
  );
  return res.rows[0] ?? null;
}

export async function getSlackInstallationForTeam(
  client: pg.PoolClient,
  slackTeamId: string,
): Promise<DbSlackInstallation | null> {
  const res = await client.query<DbSlackInstallation>(
    `select *
     from slack_installations
     where slack_team_id = $1
     order by installed_at desc
     limit 1`,
    [slackTeamId],
  );
  return res.rows[0] ?? null;
}

