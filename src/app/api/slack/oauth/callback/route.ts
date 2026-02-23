import { getEnv } from "@/src/server/env";
import { withClient } from "@/src/server/db";
import { errorJson } from "@/src/server/http";
import { upsertSlackInstallation } from "@/src/server/repo/slackInstallations";
import { getWorkspaceById } from "@/src/server/repo/workspaces";
import { verifySlackState } from "@/src/server/slack/state";

type SlackOauthResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: { id: string; name: string };
  enterprise?: { id: string; name: string } | null;
};

export async function GET(request: Request) {
  const env = getEnv();
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) return errorJson(400, "Slack OAuth not configured");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  if (!code || !stateToken) return errorJson(400, "Missing code/state");

  const state = await verifySlackState(stateToken);
  if (!state) return errorJson(400, "Invalid state");

  const redirectUri = `${env.APP_BASE_URL}/api/slack/oauth/callback`;
  const body = new URLSearchParams();
  body.set("client_id", env.SLACK_CLIENT_ID);
  body.set("client_secret", env.SLACK_CLIENT_SECRET);
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  const resp = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await resp.json().catch(() => null)) as SlackOauthResponse | null;
  if (!data?.ok || !data.access_token || !data.bot_user_id || !data.team?.id) {
    return errorJson(400, "Slack OAuth failed", { slackError: data?.error ?? "unknown" });
  }

  await withClient(async (client) => {
    await upsertSlackInstallation(client, {
      workspaceId: state.workspaceId,
      slackTeamId: data.team!.id,
      slackTeamName: data.team?.name ?? null,
      slackEnterpriseId: data.enterprise?.id ?? null,
      botUserId: data.bot_user_id!,
      botToken: data.access_token!,
      installedBy: state.installedBy,
    });
  });

  const workspace = await withClient((client) => getWorkspaceById(client, state.workspaceId));
  const workspaceSlug = workspace?.slug ?? "demo";
  return Response.redirect(`${env.APP_BASE_URL}/w/${workspaceSlug}?slack=connected`, 302);
}

