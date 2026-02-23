import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { updateBlockContent } from "@/src/server/repo/artifacts";

const schema = z.object({
  contentMd: z.string(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ artifactId: string; blockId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { blockId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  await withClient((client) =>
    updateBlockContent(client, {
      workspaceId: session.workspaceId,
      blockId,
      contentMd: parsed.data.contentMd,
      userId: session.userId,
    }),
  );
  return json({ ok: true });
}

