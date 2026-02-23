import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { getContributionForWorkspace } from "@/src/server/repo/contributions";

export async function GET(
  _: Request,
  context: { params: Promise<{ workspaceSlug: string; contributionId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug, contributionId } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const contribution = await withClient((client) =>
    getContributionForWorkspace(client, session.workspaceId, contributionId),
  );
  if (!contribution) return errorJson(404, "Not found");

  return json({
    contribution: {
      id: contribution.id,
      source: contribution.source,
      created_at: contribution.created_at,
      transcript: contribution.transcript,
      text_content: contribution.text_content,
      intent: contribution.intent,
      intent_confidence: contribution.intent_confidence,
      artifact_id: contribution.artifact_id,
    },
  });
}

