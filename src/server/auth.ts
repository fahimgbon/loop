import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { getEnv } from "@/src/server/env";

export type Session = {
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  role: "admin" | "member";
};

const SESSION_COOKIE = "loop_session";

function getJwtSecret() {
  const env = getEnv();
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const verified = await jwtVerify(raw, getJwtSecret());
    return verified.payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: Session) {
  const token = await createSessionToken(session);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

