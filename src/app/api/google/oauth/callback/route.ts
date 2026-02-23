import { getEnv } from "@/src/server/env";
import { withClient } from "@/src/server/db";
import { errorJson } from "@/src/server/http";
import { upsertGoogleInstallation } from "@/src/server/repo/googleInstallations";
import { getWorkspaceById } from "@/src/server/repo/workspaces";
import { verifyGoogleState } from "@/src/server/google/state";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  hd?: string;
};

export async function GET(request: Request) {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return errorJson(400, "Google OAuth not configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  if (!code || !stateToken) return errorJson(400, "Missing code/state");

  const state = await verifyGoogleState(stateToken);
  if (!state) return errorJson(400, "Invalid state");

  const redirectUri = `${env.APP_BASE_URL}/api/google/oauth/callback`;
  const body = new URLSearchParams();
  body.set("client_id", env.GOOGLE_CLIENT_ID);
  body.set("client_secret", env.GOOGLE_CLIENT_SECRET);
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("grant_type", "authorization_code");

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenData = (await tokenResp.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!tokenData?.access_token) {
    return errorJson(400, "Google OAuth failed", { error: tokenData?.error ?? "unknown" });
  }
  const accessToken = tokenData.access_token;

  let userInfo: GoogleUserInfo | null = null;
  try {
    const userResp = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    userInfo = (await userResp.json().catch(() => null)) as GoogleUserInfo | null;
  } catch {
    userInfo = null;
  }

  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  await withClient((client) =>
    upsertGoogleInstallation(client, {
      workspaceId: state.workspaceId,
      googleUserId: userInfo?.sub ?? null,
      email: userInfo?.email ?? null,
      hostedDomain: userInfo?.hd ?? null,
      scope: tokenData.scope ?? null,
      accessToken,
      refreshToken: tokenData.refresh_token ?? null,
      tokenType: tokenData.token_type ?? null,
      tokenExpiresAt,
      installedBy: state.installedBy,
    }),
  );

  const workspace = await withClient((client) => getWorkspaceById(client, state.workspaceId));
  const workspaceSlug = workspace?.slug ?? "demo";
  return Response.redirect(`${env.APP_BASE_URL}/w/${workspaceSlug}?google=connected`, 302);
}
