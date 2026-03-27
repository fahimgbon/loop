import { z } from "zod";

import { getRequestSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { addTextReviewResponse } from "@/src/server/services/reviewResponseService";

const schema = z.object({
  text: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceSlug: string; reviewRequestId: string }> },
) {
  const session = await getRequestSession(request);
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug, reviewRequestId } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const created = await addTextReviewResponse({
    workspaceId: session.workspaceId,
    reviewRequestId,
    userId: session.userId,
    text: parsed.data.text,
  });
  if (!created) return errorJson(404, "Not found");

  return json({ ok: true, contributionId: created.contributionId });
}
