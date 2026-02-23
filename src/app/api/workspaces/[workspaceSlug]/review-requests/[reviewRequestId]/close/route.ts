import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { closeReviewRequest } from "@/src/server/repo/reviewRequests";

export async function POST(
  _: Request,
  context: { params: Promise<{ workspaceSlug: string; reviewRequestId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug, reviewRequestId } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  await withClient((client) => closeReviewRequest(client, { workspaceId: session.workspaceId, reviewRequestId }));
  return json({ ok: true });
}

