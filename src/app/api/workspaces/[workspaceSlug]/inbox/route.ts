import { getRequestSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { listInboxContributions } from "@/src/server/repo/contributions";

export async function GET(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getRequestSession(request);
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const items = await withClient((client) => listInboxContributions(client, session.workspaceId));
  return json({ items });
}
