import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import {
  getArtifact,
  getBlock,
  getNextBlockPosition,
  insertBlock,
  insertBlockAtPosition,
} from "@/src/server/repo/artifacts";

const schema = z.object({
  type: z.string().min(1),
  title: z.string().optional(),
  contentMd: z.string().optional(),
  insertPosition: z.number().int().min(1).optional(),
  afterBlockId: z.string().uuid().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { artifactId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  try {
    const created = await withClient(async (client) => {
      await client.query("begin;");
      try {
        const artifact = await getArtifact(client, session.workspaceId, artifactId);
        if (!artifact) {
          await client.query("rollback;");
          return null;
        }
        let position: number;
        if (parsed.data.insertPosition != null) {
          position = parsed.data.insertPosition;
        } else if (parsed.data.afterBlockId) {
          const after = await getBlock(client, artifactId, parsed.data.afterBlockId);
          if (!after) throw new Error("afterBlockId not found");
          position = after.position + 1;
        } else {
          position = await getNextBlockPosition(client, artifactId);
        }
        const block =
          parsed.data.insertPosition != null || parsed.data.afterBlockId != null
            ? await insertBlockAtPosition(client, {
                artifactId,
                type: parsed.data.type,
                title: parsed.data.title ?? null,
                contentMd: parsed.data.contentMd ?? "",
                position,
                meta: {},
                userId: session.userId,
              })
            : await insertBlock(client, {
                artifactId,
                type: parsed.data.type,
                title: parsed.data.title ?? null,
                contentMd: parsed.data.contentMd ?? "",
                position,
                meta: {},
                userId: session.userId,
              });

        await client.query(`update artifacts set updated_at = now() where id = $1`, [artifactId]);
        await client.query("commit;");
        return { blockId: block.id, position };
      } catch (err) {
        await client.query("rollback;");
        throw err;
      }
    });

    if (!created) return errorJson(404, "Not found");
    return json({ ok: true, blockId: created.blockId, position: created.position });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return errorJson(400, message);
  }
}
