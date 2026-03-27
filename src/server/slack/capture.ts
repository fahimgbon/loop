import { SignJWT, jwtVerify } from "jose";

import { getEnv } from "@/src/server/env";

export type SlackCaptureContext = {
  workspaceId: string;
  workspaceSlug: string;
  slackTeamId: string;
  channelId: string;
  slackUserId: string;
};

function getSlackCaptureSecret() {
  const env = getEnv();
  return new TextEncoder().encode(`${env.SESSION_SECRET}:slack-capture`);
}

export async function createSlackCaptureToken(input: SlackCaptureContext) {
  return new SignJWT({
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    slackTeamId: input.slackTeamId,
    channelId: input.channelId,
    slackUserId: input.slackUserId,
    kind: "slack_capture",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSlackCaptureSecret());
}

export async function verifySlackCaptureToken(token: string): Promise<SlackCaptureContext | null> {
  try {
    const verified = await jwtVerify(token, getSlackCaptureSecret());
    const payload = verified.payload as Partial<SlackCaptureContext> & { kind?: string };
    if (payload.kind !== "slack_capture") return null;
    if (
      typeof payload.workspaceId !== "string" ||
      typeof payload.workspaceSlug !== "string" ||
      typeof payload.slackTeamId !== "string" ||
      typeof payload.channelId !== "string" ||
      typeof payload.slackUserId !== "string"
    ) {
      return null;
    }
    return {
      workspaceId: payload.workspaceId,
      workspaceSlug: payload.workspaceSlug,
      slackTeamId: payload.slackTeamId,
      channelId: payload.channelId,
      slackUserId: payload.slackUserId,
    };
  } catch {
    return null;
  }
}
