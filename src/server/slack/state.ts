import { SignJWT, jwtVerify } from "jose";

import { getEnv } from "@/src/server/env";

export type SlackState = {
  workspaceId: string;
  installedBy: string;
};

function getStateSecret() {
  const env = getEnv();
  if (!env.SLACK_STATE_SECRET) throw new Error("Missing SLACK_STATE_SECRET");
  return new TextEncoder().encode(env.SLACK_STATE_SECRET);
}

export async function createSlackState(state: SlackState) {
  return new SignJWT(state)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getStateSecret());
}

export async function verifySlackState(token: string): Promise<SlackState | null> {
  try {
    const verified = await jwtVerify(token, getStateSecret());
    return verified.payload as unknown as SlackState;
  } catch {
    return null;
  }
}

