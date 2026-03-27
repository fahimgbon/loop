import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { getEnv } from "@/src/server/env";

export type Session = {
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  role: "admin" | "member";
};

type TokenKind = "session" | "extension";

const SESSION_COOKIE = "loop_session";

function getJwtSecret() {
  const env = getEnv();
  return new TextEncoder().encode(env.SESSION_SECRET);
}

async function signSessionLikeToken(session: Session, input: { kind: TokenKind; expiresIn: string }): Promise<string> {
  return new SignJWT({ ...session, kind: input.kind })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(input.expiresIn)
    .sign(getJwtSecret());
}

export async function createSessionToken(session: Session): Promise<string> {
  return signSessionLikeToken(session, { kind: "session", expiresIn: "30d" });
}

export async function createExtensionToken(session: Session): Promise<string> {
  return signSessionLikeToken(session, { kind: "extension", expiresIn: "90d" });
}

async function verifyToken(token: string, expectedKind?: TokenKind): Promise<Session | null> {
  try {
    const verified = await jwtVerify(token, getJwtSecret());
    const payload = verified.payload as Partial<Session> & { kind?: TokenKind };
    const kind = payload.kind ?? "session";
    if (expectedKind && kind !== expectedKind) return null;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.workspaceId !== "string" ||
      typeof payload.workspaceSlug !== "string" ||
      (payload.role !== "admin" && payload.role !== "member")
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      workspaceSlug: payload.workspaceSlug,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifyToken(raw, "session");
}

export async function getExtensionSession(request: Request): Promise<Session | null> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyToken(match[1], "extension");
}

export async function getRequestSession(request: Request): Promise<Session | null> {
  const extensionSession = await getExtensionSession(request);
  if (extensionSession) return extensionSession;
  return getSession();
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
