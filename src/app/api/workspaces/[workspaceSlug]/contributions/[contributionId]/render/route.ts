import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { renderContributionToArtifact } from "@/src/server/services/renderService";

const schema = z.object({
  title: z.string().min(2),
  templateSlug: z.string().min(1).default("prd"),
  folderId: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceSlug: string; contributionId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug, contributionId } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const created = await renderContributionToArtifact({
    workspaceId: session.workspaceId,
    contributionId,
    createdBy: session.userId,
    title: parsed.data.title,
    templateSlug: parsed.data.templateSlug,
    folderId: parsed.data.folderId,
  });
  if (!created) return errorJson(404, "Not found");

  return json({ ok: true, artifactId: created.artifactId });
}
