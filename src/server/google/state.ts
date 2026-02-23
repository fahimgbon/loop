import { SignJWT, jwtVerify } from "jose";

import { getEnv } from "@/src/server/env";

export type GoogleState = {
  workspaceId: string;
  installedBy: string;
};

function getStateSecret() {
  const env = getEnv();
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function createGoogleState(state: GoogleState) {
  return new SignJWT(state)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getStateSecret());
}

export async function verifyGoogleState(token: string): Promise<GoogleState | null> {
  try {
    const verified = await jwtVerify(token, getStateSecret());
    return verified.payload as unknown as GoogleState;
  } catch {
    return null;
  }
}
