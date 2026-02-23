import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { withClient } from "@/src/server/db";
import { listArtifacts } from "@/src/server/repo/artifacts";
import { createArtifactFromTemplate } from "@/src/server/services/artifactService";

export async function GET(_: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const artifacts = await withClient((client) => listArtifacts(client, session.workspaceId));
  return json({ artifacts });
}

const createSchema = z.object({
  title: z.string().min(2),
  templateSlug: z.string().min(1).optional(),
  folderId: z.string().uuid().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  try {
    const created = await createArtifactFromTemplate({
      workspaceId: session.workspaceId,
      createdBy: session.userId,
      templateSlug: parsed.data.templateSlug,
      folderId: parsed.data.folderId,
      title: parsed.data.title,
    });
    return json({ ok: true, artifactId: created.artifactId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return errorJson(400, message);
  }
}
