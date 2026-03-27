import { getRequestSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { getWorkspaceSearchExplorer } from "@/src/server/services/searchExplorerService";

export async function GET(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getRequestSession(request);
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const { searchParams } = new URL(request.url);
  const result = await getWorkspaceSearchExplorer({
    workspaceId: session.workspaceId,
    q: searchParams.get("q") ?? "",
  });

  return json(result);
}
