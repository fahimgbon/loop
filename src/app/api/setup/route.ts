import { z } from "zod";

import { setSessionCookie } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { slugify } from "@/src/server/slug";
import { setupWorkspaceAndAdmin } from "@/src/server/services/authService";

const schema = z.object({
  workspaceName: z.string().min(2),
  workspaceSlug: z
    .string()
    .min(2)
    .transform((s) => slugify(s)),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  try {
    const created = await setupWorkspaceAndAdmin(parsed.data);
    await setSessionCookie(created);
    return json({ ok: true, workspaceSlug: created.workspaceSlug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup failed";
    return errorJson(400, message);
  }
}

