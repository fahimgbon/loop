import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { getArtifact, listBlocks, updateArtifactTitle } from "@/src/server/repo/artifacts";

export async function GET(_: Request, context: { params: Promise<{ artifactId: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { artifactId } = await context.params;
  const artifact = await withClient((client) => getArtifact(client, session.workspaceId, artifactId));
  if (!artifact) return errorJson(404, "Not found");
  const blocks = await withClient((client) => listBlocks(client, artifact.id));
  return json({ artifact, blocks });
}

const patchSchema = z.object({
  title: z.string().min(2),
});

export async function PATCH(request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { artifactId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  await withClient((client) =>
    updateArtifactTitle(client, { workspaceId: session.workspaceId, artifactId, title: parsed.data.title }),
  );
  return json({ ok: true });
}

