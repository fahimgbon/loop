import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { applyFolderSync, getFolderSyncPreview } from "@/src/server/services/folderService";

const applySchema = z.object({
  applyAdditions: z.boolean().default(true),
  applyDeletions: z.boolean().default(false),
});

export async function GET(
  _: Request,
  context: { params: Promise<{ artifactId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { artifactId } = await context.params;
  const preview = await withClient((client) =>
    getFolderSyncPreview(client, { workspaceId: session.workspaceId, artifactId }),
  );
  if (!preview) return errorJson(404, "Not found");
  return json({ preview });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ artifactId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const body = await request.json().catch(() => null);
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const { artifactId } = await context.params;
  try {
    const result = await withClient(async (client) => {
      await client.query("begin;");
      try {
        const applied = await applyFolderSync(client, {
          workspaceId: session.workspaceId,
          artifactId,
          userId: session.userId,
          applyAdditions: parsed.data.applyAdditions,
          applyDeletions: parsed.data.applyDeletions,
        });
        if (!applied) {
          await client.query("rollback;");
          return null;
        }
        const preview = await getFolderSyncPreview(client, {
          workspaceId: session.workspaceId,
          artifactId,
        });
        await client.query("commit;");
        return { applied, preview };
      } catch (err) {
        await client.query("rollback;");
        throw err;
      }
    });
    if (!result) return errorJson(404, "Not found");
    return json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return errorJson(400, message);
  }
}
