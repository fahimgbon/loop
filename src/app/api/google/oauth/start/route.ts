import { getSession } from "@/src/server/auth";
import { getEnv } from "@/src/server/env";
import { errorJson } from "@/src/server/http";
import { createGoogleState } from "@/src/server/google/state";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.redirect(new URL("/login", request.url).toString(), 302);
  if (session.role !== "admin") return errorJson(403, "Admin only");

  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID) return errorJson(400, "Missing GOOGLE_CLIENT_ID");

  const url = new URL(request.url);
  const workspaceSlug = url.searchParams.get("workspaceSlug");
  if (!workspaceSlug || workspaceSlug !== session.workspaceSlug) return errorJson(400, "Invalid workspace");

  const state = await createGoogleState({ workspaceId: session.workspaceId, installedBy: session.userId });
  const redirectUri = `${env.APP_BASE_URL}/api/google/oauth/callback`;
  const scopes = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
  ].join(" ");

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "consent");
  authorizeUrl.searchParams.set("include_granted_scopes", "true");
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("state", state);

  return Response.redirect(authorizeUrl.toString(), 302);
}
