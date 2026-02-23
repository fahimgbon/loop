import { z } from "zod";

import { setSessionCookie } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { loginWithPassword } from "@/src/server/services/authService";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const session = await loginWithPassword(parsed.data);
  if (!session) return errorJson(401, "Invalid credentials");

  await setSessionCookie({
    userId: session.userId,
    workspaceId: session.workspaceId,
    workspaceSlug: session.workspaceSlug,
    role: session.role,
  });

  return json({ ok: true, workspaceSlug: session.workspaceSlug });
}

