import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { getArtifact, reorderArtifactBlocks } from "@/src/server/repo/artifacts";

const schema = z.object({
  blockIds: z.array(z.string().uuid()).min(1),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ artifactId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { artifactId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  try {
    const updated = await withClient(async (client) => {
      await client.query("begin;");
      try {
        const artifact = await getArtifact(client, session.workspaceId, artifactId);
        if (!artifact) {
          await client.query("rollback;");
          return null;
        }

        await reorderArtifactBlocks(client, {
          artifactId,
          orderedBlockIds: parsed.data.blockIds,
        });
        await client.query(`update artifacts set updated_at = now() where id = $1`, [artifactId]);

        await client.query("commit;");
        return true;
      } catch (err) {
        await client.query("rollback;");
        throw err;
      }
    });
    if (!updated) return errorJson(404, "Not found");
    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reorder failed";
    return errorJson(400, message);
  }
}
