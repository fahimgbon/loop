import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { getArtifact } from "@/src/server/repo/artifacts";
import { applySuggestionDecision } from "@/src/server/services/feedbackSuggestionService";

export async function POST(
  _: Request,
  context: { params: Promise<{ artifactId: string; suggestionId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { artifactId, suggestionId } = await context.params;
  const artifact = await withClient((client) => getArtifact(client, session.workspaceId, artifactId));
  if (!artifact) return errorJson(404, "Not found");

  const result = await withClient(async (client) => {
    await client.query("begin;");
    try {
      const updated = await applySuggestionDecision(client, {
        workspaceId: session.workspaceId,
        artifactId,
        feedbackItemId: suggestionId,
        action: "accept",
        userId: session.userId,
      });
      await client.query("commit;");
      return updated;
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
  if (!result.ok) return errorJson(404, "Suggestion not found");
  return json({ ok: true, updatedBlockId: result.updatedBlockId });
}
