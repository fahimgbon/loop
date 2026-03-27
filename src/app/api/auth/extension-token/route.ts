import { z } from "zod";

import { createExtensionToken, getSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { loginWithPassword } from "@/src/server/services/authService";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const token = await createExtensionToken(session);
  return json({
    ok: true,
    token,
    session,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const session = await loginWithPassword(parsed.data);
  if (!session) return errorJson(401, "Invalid credentials");

  const token = await createExtensionToken({
    userId: session.userId,
    workspaceId: session.workspaceId,
    workspaceSlug: session.workspaceSlug,
    role: session.role,
  });

  return json({
    ok: true,
    token,
    session: {
      userId: session.userId,
      workspaceId: session.workspaceId,
      workspaceSlug: session.workspaceSlug,
      role: session.role,
      name: session.name,
      email: session.email,
    },
  });
}
