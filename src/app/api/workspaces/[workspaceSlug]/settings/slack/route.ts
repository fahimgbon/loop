import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { setWorkspaceDefaultSlackChannel } from "@/src/server/repo/workspaces";

const schema = z.object({
  defaultChannelId: z.string().min(1).nullable(),
});

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");
  if (session.role !== "admin") return errorJson(403, "Admin only");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  await withClient((client) =>
    setWorkspaceDefaultSlackChannel(client, {
      workspaceId: session.workspaceId,
      channelId: parsed.data.defaultChannelId,
    }),
  );
  return json({ ok: true });
}

