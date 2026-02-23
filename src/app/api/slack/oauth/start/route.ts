import { getSession } from "@/src/server/auth";
import { getEnv } from "@/src/server/env";
import { errorJson } from "@/src/server/http";
import { createSlackState } from "@/src/server/slack/state";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 302);
  if (session.role !== "admin") return errorJson(403, "Admin only");

  const env = getEnv();
  if (!env.SLACK_CLIENT_ID) return errorJson(400, "Missing SLACK_CLIENT_ID");

  const url = new URL(request.url);
  const workspaceSlug = url.searchParams.get("workspaceSlug");
  if (!workspaceSlug || workspaceSlug !== session.workspaceSlug) return errorJson(400, "Invalid workspace");

  const state = await createSlackState({ workspaceId: session.workspaceId, installedBy: session.userId });
  const redirectUri = `${env.APP_BASE_URL}/api/slack/oauth/callback`;
  const scopes = ["commands", "chat:write", "app_mentions:read"].join(",");

  const authorizeUrl = new URL("https://slack.com/oauth/v2/authorize");
  authorizeUrl.searchParams.set("client_id", env.SLACK_CLIENT_ID);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  return Response.redirect(authorizeUrl.toString(), 302);
}

