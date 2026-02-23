import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { linkContributionToArtifact } from "@/src/server/repo/contributions";
import { createArtifactFromTemplate } from "@/src/server/services/artifactService";

const schema = z.object({
  contributionId: z.string().min(1),
  title: z.string().min(2),
  templateSlug: z.string().min(1).default("prd"),
});

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const created = await createArtifactFromTemplate({
    workspaceId: session.workspaceId,
    createdBy: session.userId,
    templateSlug: parsed.data.templateSlug,
    title: parsed.data.title,
  });

  await withClient((client) =>
    linkContributionToArtifact(client, {
      workspaceId: session.workspaceId,
      contributionId: parsed.data.contributionId,
      artifactId: created.artifactId,
    }),
  );

  return json({ ok: true, artifactId: created.artifactId });
}

