import { z } from "zod";

import { getRequestSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { createWebTextContribution } from "@/src/server/services/contributionService";

const schema = z.object({
  artifactId: z.string().optional(),
  blockId: z.string().optional(),
  text: z.string().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getRequestSession(request);
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const created = await createWebTextContribution({
    workspaceId: session.workspaceId,
    userId: session.userId,
    artifactId: parsed.data.artifactId ?? null,
    blockId: parsed.data.blockId ?? null,
    text: parsed.data.text,
  });

  return json({ ok: true, contributionId: created.id });
}
